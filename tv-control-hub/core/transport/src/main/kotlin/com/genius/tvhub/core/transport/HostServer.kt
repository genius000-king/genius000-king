package com.genius.tvhub.core.transport

import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.protocol.Channel
import com.genius.tvhub.core.security.FramePipe
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.plugins.origin
import io.ktor.server.routing.routing
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import io.ktor.server.websocket.timeout
import io.ktor.server.websocket.webSocket
import kotlin.time.Duration.Companion.seconds

/** One incoming WebSocket, before any handshake. */
class Incoming(val channel: Channel, val pipe: FramePipe, val remoteAddress: String)

/**
 * The TV's listening socket. Knows nothing about security or features: it hands each WebSocket
 * to [onConnection] and keeps it open until that returns.
 */
class HostServer(
    private val port: Int,
    private val onConnection: suspend (Incoming) -> Unit,
) {
    private var server: EmbeddedServer<*, *>? = null

    /** The port actually bound (useful when [port] is 0 in tests). */
    var boundPort: Int = -1
        private set

    suspend fun start() {
        check(server == null) { "already started" }
        val s = embeddedServer(CIO, port = port, host = "0.0.0.0") {
            install(WebSockets) {
                pingPeriod = 5.seconds
                timeout = 15.seconds
                maxFrameSize = MAX_FRAME
                masking = false
            }
            routing {
                Channel.entries.forEach { channel ->
                    webSocket(channel.path) {
                        val remote = call.request.origin.remoteAddress
                        try {
                            onConnection(Incoming(channel, WebSocketPipe(this), remote))
                        } catch (e: Exception) {
                            if (e !is kotlinx.coroutines.CancellationException) Log.w(TAG, "${channel.name} from $remote ended: ${e.message}")
                        }
                    }
                }
            }
        }
        s.startSuspend(wait = false)
        boundPort = s.engine.resolvedConnectors().first().port
        server = s
        Log.i(TAG, "listening on $boundPort")
    }

    fun stop() {
        server?.stop(gracePeriodMillis = 200, timeoutMillis = 1000)
        server = null
    }

    companion object {
        private const val TAG = "HostServer"
        const val DEFAULT_PORT = 47800
        /** Above the largest message: a 256 KiB file chunk plus framing. */
        const val MAX_FRAME = 4L * 1024 * 1024
    }
}
