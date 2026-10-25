package com.genius.tvhub.core.security

import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PeerInfo
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.cbor.Cbor
import kotlinx.serialization.decodeFromByteArray
import kotlinx.serialization.encodeToByteArray

/** Plain-text handshake messages (the first three). Everything after them is encrypted. */
@Serializable
internal sealed interface Handshake {
    @Serializable @SerialName("ch")
    class ClientHello(
        val version: Int,
        val peer: PeerInfo,
        val identityKey: ByteArray,
        val ephemeralKey: ByteArray,
        val nonce: ByteArray,
        val channel: String,
    ) : Handshake

    /** The part of ServerHello that is hashed into the transcript and signed. */
    @Serializable @SerialName("sb")
    class ServerBody(
        val version: Int,
        val peer: PeerInfo,
        val identityKey: ByteArray,
        val ephemeralKey: ByteArray,
        val nonce: ByteArray,
    ) : Handshake

    @Serializable @SerialName("sh")
    class ServerHello(val body: ByteArray, val signature: ByteArray) : Handshake

    @Serializable @SerialName("rj")
    class Reject(val version: Int, val reason: String) : Handshake

    @Serializable @SerialName("cf")
    class ClientFinish(val signature: ByteArray) : Handshake
}

/** The server's verdict, sent encrypted. A first pairing sends [Waiting] before the final one. */
@Serializable
internal sealed interface Admission {
    @Serializable @SerialName("wait") data class Waiting(val sas: String) : Admission
    @Serializable @SerialName("in") data class Admitted(val grants: Grants) : Admission
    @Serializable @SerialName("no") data class Denied(val reason: String) : Admission
}

@OptIn(ExperimentalSerializationApi::class)
internal object HandshakeCodec {
    private val cbor = Cbor { ignoreUnknownKeys = true }
    fun encode(m: Handshake): ByteArray = cbor.encodeToByteArray(m)
    fun decode(b: ByteArray): Handshake = cbor.decodeFromByteArray(b)
    fun encodeAdmission(a: Admission): ByteArray = cbor.encodeToByteArray(a)
    fun decodeAdmission(b: ByteArray): Admission = cbor.decodeFromByteArray(b)
}
