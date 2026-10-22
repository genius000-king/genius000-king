package com.tvhub.transport.tv

import com.tvhub.protocol.CONTROL_PATH
import com.tvhub.protocol.Hello
import com.tvhub.protocol.HelloAck
import com.tvhub.protocol.PROTOCOL_VERSION
import com.tvhub.protocol.PeerRole
import com.tvhub.protocol.ProtocolCodec
import com.tvhub.protocol.ProtocolMessage
import com.tvhub.protocol.Reject
import com.tvhub.protocol.RejectCode
import com.tvhub.protocol.negotiateProtocolVersion
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.cio.CIOApplicationEngine
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.routing.routing
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.flow
import java.util.concurrent.ConcurrentHashMap

/** Events of the control channel. The TV app implements them, so the transport stays behaviour-free. */
interface ControlListener {
    fun onPeerConnected(peerId: String)

    suspend fun onMessage(peerId: String, message: ProtocolMessage)

    fun onPeerDisconnected(peerId: String)
}

/**
 * WebSocket server that runs on the TV. The first message of every connection must be [Hello].
 *
 * Spike status: plain WebSocket on the LAN. Phase P2 replaces it with TLS, pinned certificates,
 * and pairing (see docs/ARCHITECTURE.md, section 5).
 */
class ControlServer(
    private val port: Int,
    private val serverId: String,
    private val listener: ControlListener,
) {
    private val peers = ConcurrentHashMap<String, DefaultWebSocketServerSession>()
    private var server: EmbeddedServer<CIOApplicationEngine, CIOApplicationEngine.Configuration>? = null

    fun start() {
        server = embeddedServer(CIO, port = port, host = "0.0.0.0") {
            install(WebSockets)
            routing {
                webSocket(CONTROL_PATH) { handleConnection(this) }
            }
        }.also { it.start(wait = false) }
    }

    fun stop() {
        server?.stop(gracePeriodMillis = 200, timeoutMillis = 1_000)
        server = null
        peers.clear()
    }

    /** Sends a message to one connected phone. Returns false when that phone is no longer connected. */
    suspend fun send(peerId: String, message: ProtocolMessage): Boolean {
        val session = peers[peerId] ?: return false
        session.sendMessage(message)
        return true
    }

    private suspend fun handleConnection(session: DefaultWebSocketServerSession) {
        val messages = session.messages()
        val first = messages.firstOrNull() ?: return
        val peerId = handshake(session, first) ?: return

        listener.onPeerConnected(peerId)
        try {
            messages.collect { message -> listener.onMessage(peerId, message) }
        } finally {
            peers.remove(peerId)
            listener.onPeerDisconnected(peerId)
        }
    }

    /** Accepts a [Hello] and returns the phone's id, or null after rejecting the connection. */
    private suspend fun handshake(session: DefaultWebSocketServerSession, first: ProtocolMessage): String? {
        val hello = first as? Hello
        val negotiated = hello?.let { negotiateProtocolVersion(it.protocolVersion) }
        return when {
            hello == null || hello.role != PeerRole.MOBILE -> null
            negotiated == null -> {
                session.sendMessage(Reject(RejectCode.UNSUPPORTED_VERSION, "Protocol $PROTOCOL_VERSION required"))
                null
            }
            else -> {
                peers[hello.peerId] = session
                session.sendMessage(HelloAck(protocolVersion = negotiated, peerId = serverId))
                hello.peerId
            }
        }
    }

    private fun DefaultWebSocketServerSession.messages(): Flow<ProtocolMessage> = flow {
        for (frame in incoming) {
            (frame as? Frame.Text)?.readText()?.let(ProtocolCodec::decodeOrNull)?.let { emit(it) }
        }
    }

    private suspend fun DefaultWebSocketServerSession.sendMessage(message: ProtocolMessage) {
        send(Frame.Text(ProtocolCodec.encode(message)))
    }
}
