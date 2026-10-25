package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.data.TrustStore
import com.genius.tvhub.core.model.CapabilityCheck
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.HostStatus
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.Channel
import com.genius.tvhub.core.protocol.PROTOCOL_VERSION
import com.genius.tvhub.core.protocol.Push
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.core.security.Handshaker
import com.genius.tvhub.core.security.IdentityKey
import com.genius.tvhub.core.security.SecureSession
import com.genius.tvhub.core.transport.Incoming
import com.genius.tvhub.core.transport.RpcServer
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.transport.CallHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/** Where the live picture comes from: the screen encoder on the TV, a fake in tests. */
interface VideoSource {
    /** Makes sure screen capture is granted (may show the TV's prompt). */
    suspend fun ensureCapture(): Boolean
    fun packets(quality: StreamQuality): Flow<VideoPacket>
    fun reportQueue(queued: Int, nowMillis: Long) {}
}

/**
 * The TV's connection logic with no Android in it: handshake each WebSocket through the
 * gatekeeper, then give it what its channel is for. [HostRuntime] adds the server socket, mDNS
 * and the device name; the end-to-end tests drive this class directly.
 */
class HostCore(
    val self: PeerInfo,
    private val identity: IdentityKey,
    val gatekeeper: HostGatekeeper,
    private val trust: TrustStore,
    private val ports: HostPorts,
    private val video: VideoSource,
    private val checks: () -> List<CapabilityCheck>,
    /** Outlives single connections: an install keeps reporting even if its bulk socket closes. */
    private val scope: CoroutineScope,
) {
    private val handshaker = Handshaker(self, identity, PROTOCOL_VERSION)
    private val sessions = mutableMapOf<String, HostSession>()
    /** Every open channel of every phone, so revoking closes them all (video included). */
    private val open = mutableMapOf<String, MutableSet<SecureSession>>()
    private val _connected = MutableStateFlow<List<PeerInfo>>(emptyList())
    val connected: StateFlow<List<PeerInfo>> = _connected
    private val _streaming = MutableStateFlow(false)
    val streaming: StateFlow<Boolean> = _streaming

    suspend fun handle(incoming: Incoming) {
        val session = withTimeout(if (incoming.channel == Channel.CONTROL) 120_000 else 15_000) {
            handshaker.accept(incoming.pipe, gatekeeper, Channel.CONTROL.name)
        }
        trust.seen(session.peer.id)
        synchronized(open) { open.getOrPut(session.peer.id) { mutableSetOf() } += session }
        try { serve(incoming.channel, session) } finally { synchronized(open) { open[session.peer.id]?.remove(session) } }
    }

    private suspend fun serve(channel: Channel, session: SecureSession) {
        val grants = { gatekeeper.grantsOf(session.peer.id) }
        val handler = handlerFor(session.peer.id, CallRouter(ports, grants, { status(grants()) }))
        when (channel) {
            Channel.CONTROL -> coroutineScope {
                val host = HostSession(session.peer, RpcServer(session, this), ports, grants)
                register(host)
                try { host.run(handler) } finally { unregister(host) }
            }
            Channel.BULK -> coroutineScope { RpcServer(session, this).run(handler) }
            Channel.VIDEO -> stream(session, grants)
        }
    }

    /**
     * The router plus what outlives one reply. Same handler on every channel: an install committed
     * on the bulk channel reports its progress on the phone's control channel, where pushes go.
     */
    private fun handlerFor(peerId: String, router: CallRouter) = CallHandler { call ->
        val reply = router.handle(call) // permission gate first
        when (call) {
            is Call.WatchMetrics -> sessionOf(peerId)?.watchMetrics(call.on)
            is Call.InstallCommit -> scope.launch {
                ports.apps.commitInstall(call.transferId).collect { u ->
                    sessionOf(peerId)?.let { runCatching { it.push(Push.InstallProgress(call.transferId, u.state, u.message)) } }
                }
            }
            else -> Unit
        }
        reply
    }

    private fun sessionOf(peerId: String) = synchronized(sessions) { sessions[peerId] }

    private suspend fun stream(session: SecureSession, grants: () -> Grants) = coroutineScope {
        if (Grant.SCREEN !in grants()) return@coroutineScope
        val quality = session.receive()?.firstOrNull()?.toInt()?.let { StreamQuality.entries.getOrNull(it) } ?: StreamQuality.BALANCED
        if (!video.ensureCapture()) { Log.w(TAG, "screen capture refused on the TV"); return@coroutineScope }
        _streaming.value = true
        broadcast(Push.StreamState(true, null))
        val sender = launch {
            video.packets(quality).collect { packet ->
                val t0 = System.currentTimeMillis()
                session.send(packet.encode())
                // A slow send means frames are piling up behind it: report it as queue depth.
                video.reportQueue(((System.currentTimeMillis() - t0) / 16).toInt(), t0)
            }
        }
        try {
            while (session.receive() != null) { /* the phone sends nothing more; null means it left */ }
        } finally {
            sender.cancel()
            _streaming.value = false
            broadcast(Push.StreamState(false, null))
        }
    }

    fun status(grants: Grants) = HostStatus(self, checks(), grants, _streaming.value)

    /** Tells removed devices they are out, then closes every channel they have open. */
    suspend fun onTrustedChanged(trusted: Set<String>) {
        val gone = synchronized(sessions) { sessions.values.filter { it.peer.id !in trusted } }
        gone.forEach { runCatching { it.push(Push.Goodbye("access removed on the TV")) } }
        val toClose = synchronized(open) { open.filterKeys { it !in trusted }.values.flatten() }
        toClose.forEach { runCatching { it.close() } }
    }

    private fun register(s: HostSession) = synchronized(sessions) {
        sessions[s.peer.id] = s
        _connected.value = sessions.values.map { it.peer }
    }

    private fun unregister(s: HostSession) = synchronized(sessions) {
        if (sessions[s.peer.id] === s) sessions.remove(s.peer.id)
        _connected.value = sessions.values.map { it.peer }
    }

    private suspend fun broadcast(push: Push) = synchronized(sessions) { sessions.values.toList() }.forEach { runCatching { it.push(push) } }

    private companion object { const val TAG = "HostCore" }
}
