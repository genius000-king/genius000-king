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

/** WebRTC offer from the TV. The phone answers it. */
@Serializable
@SerialName("sdp_offer")
data class SdpOffer(
    val sdp: String,
) : ProtocolMessage

@Serializable
@SerialName("sdp_answer")
data class SdpAnswer(
    val sdp: String,
) : ProtocolMessage

@Serializable
@SerialName("ice_candidate")
data class IceCandidate(
    val candidate: String,
    val sdpMid: String?,
    val sdpMLineIndex: Int,
) : ProtocolMessage

/** Tap at a normalised point of the video: x and y are in 0..1, relative to the video frame. */
@Serializable
@SerialName("tap")
data class Tap(
    val x: Float,
    val y: Float,
) : ProtocolMessage

@Serializable
@SerialName("global_action")
data class GlobalAction(
    val action: NavAction,
) : ProtocolMessage

/** System navigation keys that an accessibility service can perform without shell access. */
@Serializable
enum class NavAction {
    @SerialName("back")
    BACK,

    @SerialName("home")
    HOME,

    @SerialName("recents")
    RECENTS,

    @SerialName("notifications")
    NOTIFICATIONS,
}

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
