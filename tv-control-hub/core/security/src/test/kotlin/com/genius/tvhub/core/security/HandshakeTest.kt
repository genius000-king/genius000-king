package com.genius.tvhub.core.security

import com.genius.tvhub.core.common.hexToBytes
import com.genius.tvhub.core.common.toHex
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PeerInfo
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertThrows
import org.junit.Test

/** Two ends of an in-memory, ordered, reliable pipe; [tamper] lets a test play man-in-the-middle. */
private class PipePair(private val tamper: (fromClient: Boolean, index: Int, bytes: ByteArray) -> ByteArray = { _, _, b -> b }) {
    private val toServer = Channel<ByteArray>(Channel.UNLIMITED)
    private val toClient = Channel<ByteArray>(Channel.UNLIMITED)
    private var c2s = 0
    private var s2c = 0
    val client = object : FramePipe {
        override suspend fun send(bytes: ByteArray) = toServer.send(tamper(true, c2s++, bytes))
        override suspend fun receive() = toClient.receiveCatching().getOrNull()
    }
    val server = object : FramePipe {
        override suspend fun send(bytes: ByteArray) = toClient.send(tamper(false, s2c++, bytes))
        override suspend fun receive() = toServer.receiveCatching().getOrNull()
    }
    fun close() { toServer.close(); toClient.close() }
}

private class Device(role: DeviceRole, name: String) {
    val key = SoftwareIdentityKey.generate()
    val peer = PeerInfo(fingerprintOf(key.publicKey), name, "test", role, "1.0")
    fun handshaker(version: Int = 1) = Handshaker(peer, key, version)
}

private class FakeGatekeeper(var known: Map<String, Gatekeeper.Verdict> = emptyMap(), val answer: Gatekeeper.Verdict = Gatekeeper.Verdict.Trusted(Grants.DEFAULT)) : Gatekeeper {
    var approvalsAsked = 0
    var shownSas: String? = null
    override fun check(peer: PeerInfo, identityKey: ByteArray) = known[peer.id] ?: Gatekeeper.Verdict.Unknown
    override suspend fun requestApproval(peer: PeerInfo, identityKey: ByteArray, sas: String): Gatekeeper.Verdict {
        approvalsAsked++
        shownSas = sas
        return answer
    }
}

class HandshakeTest {
    private val phone = Device(DeviceRole.PHONE, "Phone")
    private val tv = Device(DeviceRole.TV, "TV")

    @Test fun firstPairingAsksTvOwnerAndBothScreensShowSameCode() = runTest {
        val pipes = PipePair()
        val gate = FakeGatekeeper()
        var phoneSas: String? = null
        val server = async { tv.handshaker().accept(pipes.server, gate, "control") }
        val client = phone.handshaker().connect(pipes.client, "control", pinnedServerKey = null) { phoneSas = it }
        val host = server.await()

        assertThat(gate.approvalsAsked).isEqualTo(1)
        assertThat(phoneSas).matches("\\d{6}")
        assertThat(phoneSas).isEqualTo(gate.shownSas)
        assertThat(client.sas).isEqualTo(host.sas)
        assertThat(client.peer).isEqualTo(tv.peer)
        assertThat(host.peer).isEqualTo(phone.peer)
        assertThat(client.grants).isEqualTo(Grants.DEFAULT)

        client.send("hello tv".toByteArray())
        assertThat(String(host.receive()!!)).isEqualTo("hello tv")
        host.send("hello phone".toByteArray())
        assertThat(String(client.receive()!!)).isEqualTo("hello phone")
    }

    @Test fun pairedPhoneConnectsSilently() = runTest {
        val pipes = PipePair()
        val grants = Grants.NONE + Grant.INPUT
        val gate = FakeGatekeeper(known = mapOf(phone.peer.id to Gatekeeper.Verdict.Trusted(grants)))
        var waited = false
        val server = async { tv.handshaker().accept(pipes.server, gate, "control") }
        val client = phone.handshaker().connect(pipes.client, "control", pinnedServerKey = tv.key.publicKey) { waited = true }
        server.await()
        assertThat(gate.approvalsAsked).isEqualTo(0)
        assertThat(waited).isFalse()
        assertThat(client.grants).isEqualTo(grants)
    }

    @Test fun refusedPairingFailsBothSides() = runTest {
        val pipes = PipePair()
        val gate = FakeGatekeeper(answer = Gatekeeper.Verdict.Blocked("refused at TV"))
        val server = async { runCatching { tv.handshaker().accept(pipes.server, gate, "control") } }
        val e = runCatching { phone.handshaker().connect(pipes.client, "control", null) }.exceptionOrNull() as HandshakeException
        assertThat(e.failure).isEqualTo(HandshakeFailure.DENIED)
        assertThat(e.message).contains("refused at TV")
        assertThat((server.await().exceptionOrNull() as HandshakeException).failure).isEqualTo(HandshakeFailure.DENIED)
    }

    @Test fun unpairedPhoneCannotOpenSecondaryChannels() = runTest {
        val pipes = PipePair()
        val gate = FakeGatekeeper()
        val server = async { runCatching { tv.handshaker().accept(pipes.server, gate, "control") } }
        val e = runCatching { phone.handshaker().connect(pipes.client, "video", null) }.exceptionOrNull() as HandshakeException
        server.await()
        assertThat(e.failure).isEqualTo(HandshakeFailure.DENIED)
        assertThat(gate.approvalsAsked).isEqualTo(0)
    }

    @Test fun impostorTvWithDifferentKeyIsDetected() = runTest {
        val impostor = Device(DeviceRole.TV, "TV")
        val pipes = PipePair()
        val server = async { runCatching { impostor.handshaker().accept(pipes.server, FakeGatekeeper(), "control") } }
        val e = runCatching { phone.handshaker().connect(pipes.client, "control", pinnedServerKey = tv.key.publicKey) }.exceptionOrNull() as HandshakeException
        pipes.close()
        server.await()
        assertThat(e.failure).isEqualTo(HandshakeFailure.PEER_KEY_CHANGED)
    }

    @Test fun versionMismatchIsExplained() = runTest {
        val pipes = PipePair()
        val server = async { runCatching { tv.handshaker(version = 2).accept(pipes.server, FakeGatekeeper(), "control") } }
        val e = runCatching { phone.handshaker(version = 1).connect(pipes.client, "control", null) }.exceptionOrNull() as HandshakeException
        assertThat(e.failure).isEqualTo(HandshakeFailure.VERSION_MISMATCH)
        assertThat((server.await().exceptionOrNull() as HandshakeException).failure).isEqualTo(HandshakeFailure.VERSION_MISMATCH)
    }

    @Test fun tamperedServerHelloIsRejectedWithATypedFailure() = runTest {
        // Flip a byte in the signed body of ServerHello (server message #0) on the wire.
        val pipes = PipePair { fromClient, index, bytes ->
            if (!fromClient && index == 0) bytes.copyOf().also { it[it.size / 3] = (it[it.size / 3].toInt() xor 1).toByte() } else bytes
        }
        val server = async { runCatching { tv.handshaker().accept(pipes.server, FakeGatekeeper(), "control") } }
        val e = runCatching { phone.handshaker().connect(pipes.client, "control", null) }.exceptionOrNull()
        pipes.close()
        server.await()
        assertThat(e).isInstanceOf(HandshakeException::class.java)
        assertThat((e as HandshakeException).failure).isAnyOf(HandshakeFailure.BAD_SIGNATURE, HandshakeFailure.PROTOCOL, HandshakeFailure.ID_MISMATCH)
    }

    @Test fun spoofedPhoneIdIsRejected() = runTest {
        val pipes = PipePair()
        val server = async { runCatching { tv.handshaker().accept(pipes.server, FakeGatekeeper(), "control") } }
        // A phone claiming another device's id while presenting its own key.
        val victim = Device(DeviceRole.PHONE, "Victim")
        val eph = Crypto.newEcKeyPair()
        val hello = Handshake.ClientHello(1, victim.peer, phone.key.publicKey, eph.public.encoded, ByteArray(32), "control")
        pipes.client.send(HandshakeCodec.encode(hello))
        val failure = (server.await().exceptionOrNull() as HandshakeException).failure
        assertThat(failure).isEqualTo(HandshakeFailure.ID_MISMATCH)
        assertThat(HandshakeCodec.decode(pipes.client.receive()!!)).isInstanceOf(Handshake.Reject::class.java)
    }

    @Test fun tamperedOrReplayedDataFramesAreRejected() = runTest {
        var replay: ByteArray? = null
        val pipes = PipePair { fromClient, index, bytes ->
            // Client frames: 0 hello, 1 finish, 2+ data. Remember the first data frame.
            if (fromClient && index == 2) replay = bytes
            bytes
        }
        val gate = FakeGatekeeper(known = mapOf(phone.peer.id to Gatekeeper.Verdict.Trusted(Grants.ALL)))
        val server = async { tv.handshaker().accept(pipes.server, gate, "control") }
        val client = phone.handshaker().connect(pipes.client, "control", tv.key.publicKey)
        val host = server.await()

        client.send("first".toByteArray())
        assertThat(String(host.receive()!!)).isEqualTo("first")
        // Replay the same ciphertext: counter moved on, so authentication fails.
        pipes.client.send(replay!!)
        assertThrows(SecurityException::class.java) { kotlinx.coroutines.runBlocking { host.receive() } }
    }

    @Test fun sasIsStableAndSixDigits() {
        val th = ByteArray(32) { it.toByte() }
        assertThat(Handshaker.sasOf(th)).isEqualTo(Handshaker.sasOf(th.copyOf()))
        assertThat(Handshaker.sasOf(th)).matches("\\d{6}")
        assertThat(Handshaker.sasOf(th)).isNotEqualTo(Handshaker.sasOf(th.copyOf().also { it[0] = 99 }))
    }
}

class PrimitivesTest {
    @Test fun hkdfMatchesRfc5869Case1() {
        val okm = Primitives.hkdf(
            ikm = "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b".hexToBytes(),
            salt = "000102030405060708090a0b0c".hexToBytes(),
            info = "f0f1f2f3f4f5f6f7f8f9".hexToBytes(),
            length = 42,
        )
        assertThat(okm.toHex()).isEqualTo("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865")
    }

    @Test fun aeadRoundTripAndTagCheck() {
        val key = ByteArray(32) { 7 }
        val a = AeadChannel(key); val b = AeadChannel(key)
        repeat(3) { i -> assertThat(String(b.open(a.seal("m$i".toByteArray())))).isEqualTo("m$i") }
        val sealed = a.seal("x".toByteArray()).also { it[0] = (it[0].toInt() xor 1).toByte() }
        assertThrows(SecurityException::class.java) { b.open(sealed) }
    }

    @Test fun ecdhAgreesAndSignaturesVerify() {
        val a = Crypto.newEcKeyPair(); val b = Crypto.newEcKeyPair()
        assertThat(Primitives.ecdh(a.private, b.public.encoded)).isEqualTo(Primitives.ecdh(b.private, a.public.encoded))
        val id = SoftwareIdentityKey.generate()
        val sig = id.sign("data".toByteArray())
        assertThat(Primitives.verify(id.publicKey, "data".toByteArray(), sig)).isTrue()
        assertThat(Primitives.verify(id.publicKey, "dato".toByteArray(), sig)).isFalse()
        assertThat(Primitives.verify(id.publicKey, "data".toByteArray(), byteArrayOf(1, 2, 3))).isFalse()
    }

    @Test fun fingerprintFormatting() {
        val fp = fingerprintOf(byteArrayOf(1, 2, 3))
        assertThat(fp).hasLength(64)
        assertThat(shortFingerprint(fp)).matches("[0-9a-f]{4} [0-9a-f]{4}")
    }
}
