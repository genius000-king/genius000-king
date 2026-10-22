package com.tvhub.transport.mobile

import com.tvhub.common.AppError
import com.tvhub.common.AppResult
import com.tvhub.protocol.CONTROL_PATH
import com.tvhub.protocol.Hello
import com.tvhub.protocol.HelloAck
import com.tvhub.protocol.PROTOCOL_VERSION
import com.tvhub.protocol.PeerRole
import com.tvhub.protocol.ProtocolCodec
import com.tvhub.protocol.ProtocolMessage
import com.tvhub.protocol.Reject
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocketSession
import io.ktor.http.URLProtocol
import io.ktor.http.path
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/**
 * Phone side of the control channel. Owns one WebSocket to the TV and exposes the messages it receives.
 *
 * Spike status: plain WebSocket on the LAN, and no pairing. Phase P2 adds TLS and pinning.
 */
class ControlClient(
    private val scope: CoroutineScope,
    private val peerId: String,
) {
    private val http = HttpClient(CIO) { install(WebSockets) }
    private var session: DefaultClientWebSocketSession? = null

    private val _incoming = MutableSharedFlow<ProtocolMessage>(extraBufferCapacity = 64)
    val incoming: SharedFlow<ProtocolMessage> = _incoming.asSharedFlow()

    /** Opens the socket and completes the [Hello] handshake within [HANDSHAKE_TIMEOUT_MS]. */
    // Network stacks throw many unrelated types. All of them become one AppResult.Failure here.
    @Suppress("TooGenericExceptionCaught")
    suspend fun connect(host: String, port: Int): AppResult<Unit> = try {
        handshake(open(host, port))
    } catch (failure: Exception) {
        AppResult.Failure(AppError("transport.connect_failed", "Cannot reach $host:$port", failure))
    }

    suspend fun send(message: ProtocolMessage): AppResult<Unit> {
        val ws = session ?: return AppResult.Failure(AppError("transport.not_connected", "Not connected"))
        ws.send(Frame.Text(ProtocolCodec.encode(message)))
        return AppResult.Success(Unit)
    }

    fun close() {
        scope.launch {
            session?.close()
            session = null
        }
    }

    fun release() {
        close()
        http.close()
    }

    private suspend fun open(host: String, port: Int): DefaultClientWebSocketSession {
        val ws = http.webSocketSession {
            url {
                protocol = URLProtocol.WS
                this.host = host
                this.port = port
                path(CONTROL_PATH)
            }
        }
        ws.send(Frame.Text(ProtocolCodec.encode(Hello(PROTOCOL_VERSION, peerId, PeerRole.MOBILE))))
        return ws
    }

    private suspend fun handshake(ws: DefaultClientWebSocketSession): AppResult<Unit> {
        val reply = withTimeout(HANDSHAKE_TIMEOUT_MS) {
            ws.messages().first { it is HelloAck || it is Reject }
        }
        return when (reply) {
            is HelloAck -> {
                session = ws
                scope.launch { pump(ws) }
                AppResult.Success(Unit)
            }
            is Reject -> rejected(ws, reply.message)
            else -> rejected(ws, "Unexpected reply ${reply::class.simpleName}")
        }
    }

    private suspend fun rejected(ws: DefaultClientWebSocketSession, reason: String): AppResult<Unit> {
        ws.close()
        return AppResult.Failure(AppError("transport.rejected", reason))
    }

    private suspend fun pump(ws: DefaultClientWebSocketSession) {
        try {
            ws.messages().collect { _incoming.emit(it) }
        } finally {
            session = null
        }
    }

    /** Protocol messages from the socket. Frames that are not text, malformed, or unknown are skipped. */
    private fun DefaultClientWebSocketSession.messages(): Flow<ProtocolMessage> = flow {
        for (frame in incoming) {
            (frame as? Frame.Text)?.readText()?.let(ProtocolCodec::decodeOrNull)?.let { emit(it) }
        }
    }

    private companion object {
        const val HANDSHAKE_TIMEOUT_MS = 5_000L
    }
}
