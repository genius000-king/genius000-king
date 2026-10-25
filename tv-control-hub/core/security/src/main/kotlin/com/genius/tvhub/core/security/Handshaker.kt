package com.genius.tvhub.core.security

import com.genius.tvhub.core.common.sha256
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PeerInfo
import java.nio.ByteBuffer
import java.security.SecureRandom

/** The TV's side of trust: who is known, and asking the person at the TV about newcomers. */
interface Gatekeeper {
    sealed interface Verdict {
        data class Trusted(val grants: Grants) : Verdict
        data object Unknown : Verdict
        data class Blocked(val reason: String) : Verdict
    }

    fun check(peer: PeerInfo, identityKey: ByteArray): Verdict

    /** Suspends until the person at the TV allows or refuses. Returns Trusted or Blocked. */
    suspend fun requestApproval(peer: PeerInfo, identityKey: ByteArray, sas: String): Verdict
}

/**
 * Station-to-station handshake:
 *
 *  C → S  ClientHello(peer, identityKey, ephemeralKey, nonce, channel)
 *  S → C  ServerHello(body, sign_S("S" ‖ th))       th = SHA-256(ClientHello ‖ body)
 *  C → S  ClientFinish(sign_C("C" ‖ th))
 *  S → C  [Waiting(sas)] Admitted(grants) | Denied   — encrypted
 *
 * Keys: HKDF-SHA256(ECDH(ephemerals), salt = th) → one AES-256-GCM key per direction.
 * The SAS is derived from th, so a man in the middle changes the number on one of the screens.
 */
class Handshaker(
    private val self: PeerInfo,
    private val identity: IdentityKey,
    private val version: Int,
    private val random: SecureRandom = SecureRandom(),
) {
    init {
        require(self.id == fingerprintOf(identity.publicKey)) { "peer id must be the identity fingerprint" }
    }

    /**
     * Phone side. [pinnedServerKey] is the TV's key saved at pairing, or null on first contact.
     * [onWaiting] fires with the SAS when the TV asks its owner.
     */
    suspend fun connect(
        pipe: FramePipe,
        channel: String,
        pinnedServerKey: ByteArray?,
        onWaiting: (sas: String) -> Unit = {},
    ): SecureSession {
        val ephemeral = Crypto.newEcKeyPair()
        val hello = Handshake.ClientHello(version, self, identity.publicKey, ephemeral.public.encoded, nonce(), channel)
        val helloBytes = HandshakeCodec.encode(hello)
        pipe.send(helloBytes)

        val server = when (val m = receive(pipe)) {
            is Handshake.ServerHello -> m
            is Handshake.Reject -> throw HandshakeException(
                if (m.version != version) HandshakeFailure.VERSION_MISMATCH else HandshakeFailure.DENIED,
                "TV refused: ${m.reason} (TV protocol ${m.version}, ours $version)",
            )
            else -> throw HandshakeException(HandshakeFailure.PROTOCOL, "expected ServerHello")
        }
        val body = HandshakeCodec.decode(server.body) as? Handshake.ServerBody
            ?: throw HandshakeException(HandshakeFailure.PROTOCOL, "bad ServerHello body")
        if (body.version != version) throw HandshakeException(HandshakeFailure.VERSION_MISMATCH, "TV protocol ${body.version}, ours $version")
        if (body.peer.id != fingerprintOf(body.identityKey)) throw HandshakeException(HandshakeFailure.ID_MISMATCH, "TV id does not match its key")
        if (pinnedServerKey != null && !pinnedServerKey.contentEquals(body.identityKey)) {
            throw HandshakeException(HandshakeFailure.PEER_KEY_CHANGED, "this TV's identity changed since pairing")
        }

        val th = (helloBytes + server.body).sha256()
        if (!Primitives.verify(body.identityKey, SERVER_TAG + th, server.signature)) {
            throw HandshakeException(HandshakeFailure.BAD_SIGNATURE, "TV signature invalid")
        }
        pipe.send(HandshakeCodec.encode(Handshake.ClientFinish(identity.sign(CLIENT_TAG + th))))

        val keys = deriveKeys(Primitives.ecdh(ephemeral.private, body.ephemeralKey), th)
        val sas = sasOf(th)
        val sealer = AeadChannel(keys.c2s)
        val opener = AeadChannel(keys.s2c)
        while (true) {
            val sealed = pipe.receive() ?: throw HandshakeException(HandshakeFailure.CLOSED, "TV closed the connection")
            when (val a = HandshakeCodec.decodeAdmission(opener.open(sealed))) {
                is Admission.Waiting -> onWaiting(a.sas)
                is Admission.Admitted -> return SecureSession(body.peer, body.identityKey, a.grants, sas, pipe, sealer, opener)
                is Admission.Denied -> throw HandshakeException(HandshakeFailure.DENIED, a.reason)
            }
        }
    }

    /**
     * TV side. Only the control channel may start a pairing; the video and bulk channels of an
     * unknown phone are refused.
     */
    suspend fun accept(pipe: FramePipe, gatekeeper: Gatekeeper, pairingChannel: String): SecureSession {
        val helloBytes = pipe.receive() ?: throw HandshakeException(HandshakeFailure.CLOSED, "closed before hello")
        val hello = HandshakeCodec.decode(helloBytes) as? Handshake.ClientHello
            ?: throw HandshakeException(HandshakeFailure.PROTOCOL, "expected ClientHello")
        if (hello.version != version) {
            pipe.send(HandshakeCodec.encode(Handshake.Reject(version, "protocol mismatch")))
            throw HandshakeException(HandshakeFailure.VERSION_MISMATCH, "phone protocol ${hello.version}, ours $version")
        }
        if (hello.peer.id != fingerprintOf(hello.identityKey)) {
            pipe.send(HandshakeCodec.encode(Handshake.Reject(version, "id mismatch")))
            throw HandshakeException(HandshakeFailure.ID_MISMATCH, "phone id does not match its key")
        }

        val ephemeral = Crypto.newEcKeyPair()
        val body = HandshakeCodec.encode(Handshake.ServerBody(version, self, identity.publicKey, ephemeral.public.encoded, nonce()))
        val th = (helloBytes + body).sha256()
        pipe.send(HandshakeCodec.encode(Handshake.ServerHello(body, identity.sign(SERVER_TAG + th))))

        val finish = receive(pipe) as? Handshake.ClientFinish
            ?: throw HandshakeException(HandshakeFailure.PROTOCOL, "expected ClientFinish")
        if (!Primitives.verify(hello.identityKey, CLIENT_TAG + th, finish.signature)) {
            throw HandshakeException(HandshakeFailure.BAD_SIGNATURE, "phone signature invalid")
        }

        val keys = deriveKeys(Primitives.ecdh(ephemeral.private, hello.ephemeralKey), th)
        val sealer = AeadChannel(keys.s2c)
        val opener = AeadChannel(keys.c2s)
        val sas = sasOf(th)
        suspend fun admit(a: Admission) = pipe.send(sealer.seal(HandshakeCodec.encodeAdmission(a)))

        var verdict = gatekeeper.check(hello.peer, hello.identityKey)
        if (verdict == Gatekeeper.Verdict.Unknown) {
            if (hello.channel != pairingChannel) {
                admit(Admission.Denied("not paired"))
                throw HandshakeException(HandshakeFailure.DENIED, "unpaired phone on ${hello.channel}")
            }
            admit(Admission.Waiting(sas))
            verdict = gatekeeper.requestApproval(hello.peer, hello.identityKey, sas)
        }
        when (verdict) {
            is Gatekeeper.Verdict.Trusted -> {
                admit(Admission.Admitted(verdict.grants))
                return SecureSession(hello.peer, hello.identityKey, verdict.grants, sas, pipe, sealer, opener)
            }
            is Gatekeeper.Verdict.Blocked -> {
                admit(Admission.Denied(verdict.reason))
                throw HandshakeException(HandshakeFailure.DENIED, verdict.reason)
            }
            Gatekeeper.Verdict.Unknown -> {
                admit(Admission.Denied("no decision"))
                throw HandshakeException(HandshakeFailure.DENIED, "no decision")
            }
        }
    }

    private suspend fun receive(pipe: FramePipe): Handshake {
        val bytes = pipe.receive() ?: throw HandshakeException(HandshakeFailure.CLOSED, "connection closed during handshake")
        return try {
            HandshakeCodec.decode(bytes)
        } catch (e: Exception) {
            throw HandshakeException(HandshakeFailure.PROTOCOL, "unreadable handshake message: ${e.message}")
        }
    }

    private fun nonce() = ByteArray(32).also(random::nextBytes)

    private class Keys(val c2s: ByteArray, val s2c: ByteArray)

    private fun deriveKeys(secret: ByteArray, th: ByteArray) = Keys(
        c2s = Primitives.hkdf(secret, th, "tvhub v1 c2s".toByteArray(), 32),
        s2c = Primitives.hkdf(secret, th, "tvhub v1 s2c".toByteArray(), 32),
    )

    companion object {
        private val SERVER_TAG = "tvhub-server".toByteArray()
        private val CLIENT_TAG = "tvhub-client".toByteArray()

        /** Six digits both screens show. */
        fun sasOf(transcriptHash: ByteArray): String {
            val n = ByteBuffer.wrap(("tvhub-sas".toByteArray() + transcriptHash).sha256()).int.toLong() and 0xFFFFFFFFL
            return "%06d".format(n % 1_000_000)
        }
    }
}
