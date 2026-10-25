package com.genius.tvhub.core.transport

import com.genius.tvhub.core.security.FramePipe
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.WebSocketSession
import io.ktor.websocket.close
import kotlinx.coroutines.channels.ClosedReceiveChannelException

/** A Ktor WebSocket seen as an ordered stream of binary messages. */
internal class WebSocketPipe(private val socket: WebSocketSession) : FramePipe {
    override suspend fun send(bytes: ByteArray) = socket.send(Frame.Binary(true, bytes))

    override suspend fun receive(): ByteArray? {
        while (true) {
            val frame = try {
                socket.incoming.receive()
            } catch (_: ClosedReceiveChannelException) {
                return null
            }
            if (frame is Frame.Binary) return frame.data
            if (frame is Frame.Close) return null
        }
    }

    override suspend fun close() = socket.close(CloseReason(CloseReason.Codes.NORMAL, "closed"))
}
