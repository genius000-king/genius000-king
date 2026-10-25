package com.genius.tvhub.core.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Bumped on any incompatible change. Both sides refuse to talk across versions, with a clear message. */
const val PROTOCOL_VERSION = 1

/** Everything on the control and bulk channels is one of these, encrypted, one per WebSocket frame. */
@Serializable
sealed interface Frame {
    @Serializable @SerialName("rq") data class Request(val id: Long, val call: Call) : Frame
    @Serializable @SerialName("rs") data class Response(val id: Long, val reply: Reply) : Frame
    @Serializable @SerialName("ev") data class Event(val push: Push) : Frame
}

/** Which WebSocket a connection is. Each runs its own handshake; see the architecture doc. */
enum class Channel(val path: String) {
    CONTROL("/ws/control"),
    VIDEO("/ws/video"),
    BULK("/ws/bulk"),
}

enum class ErrorCode {
    /** The phone lacks the grant for this call. */
    DENIED,
    NOT_FOUND,
    INVALID,
    /** The TV cannot do it right now (accessibility off, Termux missing…). */
    UNAVAILABLE,
    BUSY,
    FAILED,
    TIMEOUT,
}

class RemoteException(val code: ErrorCode, message: String) : Exception(message)
