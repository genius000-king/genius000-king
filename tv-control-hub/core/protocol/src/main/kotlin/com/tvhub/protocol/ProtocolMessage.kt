package com.tvhub.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Every message exchanged over the control WebSocket.
 * The "type" field is the discriminator. Adding a new type does not break older peers,
 * because they decode unknown types as [UnknownMessage] and ignore them.
 */
@Serializable
sealed interface ProtocolMessage

@Serializable
@SerialName("hello")
data class Hello(
    val protocolVersion: Int,
    val peerId: String,
    val role: PeerRole,
) : ProtocolMessage

@Serializable
@SerialName("hello_ack")
data class HelloAck(
    val protocolVersion: Int,
    val peerId: String,
) : ProtocolMessage

@Serializable
@SerialName("reject")
data class Reject(
    val code: RejectCode,
    val message: String,
) : ProtocolMessage

@Serializable
@SerialName("ping")
data class Ping(
    val sequence: Long,
    val sentAtMillis: Long,
) : ProtocolMessage

@Serializable
@SerialName("pong")
data class Pong(
    val sequence: Long,
    val sentAtMillis: Long,
) : ProtocolMessage

/** A message whose type this build does not know. It is never sent, only received. */
data class UnknownMessage(val type: String) : ProtocolMessage

@Serializable
enum class PeerRole {
    @SerialName("tv")
    TV,

    @SerialName("mobile")
    MOBILE,
}

@Serializable
enum class RejectCode {
    @SerialName("unsupported_version")
    UNSUPPORTED_VERSION,

    @SerialName("unauthorized")
    UNAUTHORIZED,

    @SerialName("revoked")
    REVOKED,

    @SerialName("rate_limited")
    RATE_LIMITED,
}
