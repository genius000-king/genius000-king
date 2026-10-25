package com.genius.tvhub.core.transport

import com.genius.tvhub.core.protocol.Channel
import com.genius.tvhub.core.security.FramePipe
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.pingInterval
import io.ktor.client.plugins.websocket.webSocketSession
import io.ktor.client.request.url
import io.ktor.websocket.close
import kotlin.time.Duration.Companion.seconds

/** An open client WebSocket. Close it when the session ends. */
class OpenSocket internal constructor(val pipe: FramePipe, private val closer: suspend () -> Unit) {
    suspend fun close() = runCatching { closer() }.let { }
}

/** The phone's side: opens WebSockets to a TV. One client is shared by all channels. */
class HubConnector {
    private val client = HttpClient(CIO) {
        install(WebSockets) {
            pingInterval = 5.seconds
            maxFrameSize = HostServer.MAX_FRAME
        }
        install(HttpTimeout) { connectTimeoutMillis = 4_000 }
        engine { endpoint.connectTimeout = 4_000 }
    }

    suspend fun open(host: String, port: Int, channel: Channel): OpenSocket {
        val session = client.webSocketSession { url("ws://${hostLiteral(host)}:$port${channel.path}") }
        return OpenSocket(WebSocketPipe(session)) { session.close() }
    }

    fun close() = client.close()

    /** IPv6 literals need brackets in a URL. */
    private fun hostLiteral(host: String) = if (':' in host && !host.startsWith("[")) "[$host]" else host
}
