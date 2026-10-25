package com.genius.tvhub.core.security

import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PeerInfo
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** The minimum a transport must offer: ordered, reliable, message-framed. A WebSocket is one. */
interface FramePipe {
    suspend fun send(bytes: ByteArray)
    /** Next frame, or null when the other side closed. */
    suspend fun receive(): ByteArray?
}

/**
 * An authenticated, encrypted connection. [peer] and [peerKey] are verified: the peer proved it
 * holds the private key whose fingerprint is [PeerInfo.id].
 */
class SecureSession internal constructor(
    val peer: PeerInfo,
    val peerKey: ByteArray,
    val grants: Grants,
    /** The 6-digit comparison code of this connection; shown during a first pairing. */
    val sas: String,
    private val pipe: FramePipe,
    private val sealer: AeadChannel,
    private val opener: AeadChannel,
) {
    private val sendLock = Mutex()

    /** Sealing and sending happen under one lock: the receiver expects nonces in wire order. */
    suspend fun send(plain: ByteArray) = sendLock.withLock { pipe.send(sealer.seal(plain)) }

    suspend fun receive(): ByteArray? = pipe.receive()?.let(opener::open)
}

enum class HandshakeFailure {
    VERSION_MISMATCH,
    BAD_SIGNATURE,
    /** The claimed id is not the fingerprint of the key presented. */
    ID_MISMATCH,
    /** A paired device came back with a different key: possible impersonation. */
    PEER_KEY_CHANGED,
    DENIED,
    PROTOCOL,
    CLOSED,
}

class HandshakeException(val failure: HandshakeFailure, message: String) : Exception(message)
