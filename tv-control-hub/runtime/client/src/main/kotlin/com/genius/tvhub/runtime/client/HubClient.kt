package com.genius.tvhub.runtime.client

import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.data.PairedTvStore
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.discovery.FoundService
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.LinkFailure
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.model.PairedTv
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.model.TvEndpoint
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.Channel
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.PROTOCOL_VERSION
import com.genius.tvhub.core.protocol.Push
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.core.protocol.Reply
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.core.security.HandshakeException
import com.genius.tvhub.core.security.HandshakeFailure
import com.genius.tvhub.core.security.Handshaker
import com.genius.tvhub.core.security.IdentityKey
import com.genius.tvhub.core.security.SecureSession
import com.genius.tvhub.core.security.fingerprintOf
import com.genius.tvhub.core.transport.Backoff
import com.genius.tvhub.core.transport.HubConnector
import com.genius.tvhub.core.transport.OpenSocket
import com.genius.tvhub.core.transport.RpcClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.selects.select
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

/**
 * The phone's connection to its TV, with no buttons involved: on start it reconnects to the last
 * TV (or, the very first time, to the only TV on the network), keeps the link alive, reconnects
 * after drops, and exposes everything as [state] plus typed calls.
 */
class HubClient(
    private val self: PeerInfo,
    private val identity: () -> IdentityKey,
    private val discovery: () -> Flow<List<FoundService>>,
    private val paired: PairedTvStore,
    private val settings: SettingsStore,
    private val connector: HubConnector = HubConnector(),
) {
    private val _state = MutableStateFlow<LinkState>(LinkState.Searching())
    val state: StateFlow<LinkState> = _state
    private val _events = MutableSharedFlow<Push>(extraBufferCapacity = 64)
    val events: SharedFlow<Push> = _events

    private val found = MutableStateFlow<List<FoundService>>(emptyList())
    private val chosen = MutableStateFlow<TvEndpoint?>(null)
    private var rpc: RpcClient? = null
    private var current: TvEndpoint? = null
    private var currentKey: ByteArray? = null
    private var bulk: RpcClient? = null
    private var bulkSocket: OpenSocket? = null
    private val bulkLock = Mutex()
    private var retryNow = CompletableDeferred<Unit>()
    /** False after the TV refused or revoked us: never ask its owner again until the user acts. */
    @Volatile private var autoPair = true
    private var loop: Job? = null

    private lateinit var scope: CoroutineScope

    fun start(scope: CoroutineScope) {
        if (loop != null) return
        this.scope = scope
        scope.launch { discovery().collect { list -> found.value = list; publishSearch() } }
        loop = scope.launch { connectionLoop() }
    }

    /** The user picked a TV (or typed an address). */
    fun connect(tv: TvEndpoint) { chosen.value = tv; retry() }

    /** A user action ("try again"): re-allows pairing with an unknown TV. */
    fun userRetry() { autoPair = true; retry() }

    fun connectManual(host: String, port: Int) = connect(TvEndpoint("", host, host, port, paired = false))

    fun retry() { retryNow.complete(Unit) }

    suspend fun forget(id: String) {
        paired.forget(id)
        settings.update { if (it.lastTvId == id) it.copy(lastTvId = null) else it }
        if (current?.id == id) disconnect()
    }

    // ---- calls ----

    /** A request on the control channel. Throws [RemoteException] when offline or refused. */
    suspend fun call(call: Call, timeoutMillis: Long = RpcClient.DEFAULT_TIMEOUT): Reply =
        (rpc ?: throw offline()).call(call, timeoutMillis)

    /** Fire-and-forget for pointer motion: dropped silently when offline. */
    suspend fun send(call: Call) { runCatching { rpc?.send(call) } }

    /** A request on the bulk channel, opened on first use, so transfers never block the remote. */
    suspend fun bulk(call: Call, timeoutMillis: Long = 30_000): Reply {
        val client = bulkLock.withLock {
            bulk ?: run {
                val tv = current ?: throw offline()
                val socket = connector.open(tv.host, tv.port, Channel.BULK)
                val session = Handshaker(self, identity(), PROTOCOL_VERSION).connect(socket.pipe, Channel.BULK.name, currentKey)
                RpcClient(session).also { c ->
                    bulk = c; bulkSocket = socket
                    scope.launch { runCatching { c.run() }; bulkLock.withLock { if (bulk === c) { bulk = null; bulkSocket = null } } }
                }
            }
        }
        return client.call(call, timeoutMillis)
    }

    /** The TV's screen as H.264 packets. Cold: collect to watch, cancel to stop. */
    fun video(quality: StreamQuality): Flow<VideoPacket> = callbackFlow {
        val tv = current ?: throw offline()
        val socket = connector.open(tv.host, tv.port, Channel.VIDEO)
        val session = Handshaker(self, identity(), PROTOCOL_VERSION).connect(socket.pipe, Channel.VIDEO.name, currentKey)
        session.send(byteArrayOf(quality.ordinal.toByte()))
        val reader = launch {
            while (true) {
                val bytes = session.receive() ?: break
                send(VideoPacket.decode(bytes))
            }
            close()
        }
        awaitClose { reader.cancel(); kotlinx.coroutines.runBlocking { socket.close() } }
    }

    // ---- the loop ----

    private suspend fun connectionLoop() {
        val backoff = Backoff()
        while (true) {
            val target = pickTarget()
            if (target == null) { publishSearch(); waitForChange(); continue }
            try {
                session(target, backoff)
            } catch (e: HandshakeException) {
                val failure = when (e.failure) {
                    HandshakeFailure.PEER_KEY_CHANGED -> LinkFailure.KEY_CHANGED
                    HandshakeFailure.DENIED -> LinkFailure.REFUSED
                    HandshakeFailure.VERSION_MISMATCH -> LinkFailure.VERSION_MISMATCH
                    else -> null
                }
                if (failure != null) {
                    if (failure == LinkFailure.REFUSED) autoPair = false
                    _state.value = LinkState.Failed(target, failure)
                    chosen.value = null
                    waitForRetry()
                    continue
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.d(TAG, "link to ${target.name} dropped: ${e.message}")
            }
            rpc = null; closeBulk()
            if (!target.paired && _state.value !is LinkState.Connected) chosen.value = null
            _state.value = LinkState.Reconnecting(target, backoff.attempt + 1)
            withTimeoutOrNull(backoff.next()) { retryNow.await() }
            retryNow = CompletableDeferred()
        }
    }

    private suspend fun session(target: TvEndpoint, backoff: Backoff) {
        val pairedTv = target.id.takeIf { it.isNotEmpty() }?.let { paired.get(it) }
        _state.value = if (_state.value is LinkState.Reconnecting) _state.value else LinkState.Connecting(target)
        val socket = connector.open(target.host, target.port, Channel.CONTROL)
        try {
            val session = Handshaker(self, identity(), PROTOCOL_VERSION).connect(socket.pipe, Channel.CONTROL.name, pairedTv?.publicKey) { code ->
                _state.value = LinkState.AwaitingApproval(target, code)
            }
            val tv = remember(target, session)
            backoff.reset()
            val client = RpcClient(session)
            rpc = client
            current = tv
            currentKey = session.peerKey
            _state.value = LinkState.Connected(tv, null, session.grants)
            coroutineScope {
                launch { client.events.collect(::onPush) }
                launch { pingLoop(client, tv, session.grants) }
                client.run()
                coroutineContext.cancelChildren()
            }
        } finally {
            socket.close()
        }
    }

    private suspend fun remember(target: TvEndpoint, session: SecureSession): TvEndpoint {
        val id = session.peer.id
        paired.remember(id, session.peer.name, session.peerKey, target.host, target.port)
        settings.update { it.copy(lastTvId = id) }
        return TvEndpoint(id, session.peer.name, target.host, target.port, paired = true)
    }

    private suspend fun pingLoop(client: RpcClient, tv: TvEndpoint, grants: Grants) {
        while (true) {
            val t0 = System.nanoTime()
            val ok = runCatching { client.call(Call.Ping(System.currentTimeMillis()), 5_000) }.isSuccess
            if (!ok) break
            _state.value = LinkState.Connected(tv, ((System.nanoTime() - t0) / 1_000_000).toInt(), grants)
            delay(3_000)
        }
    }

    private suspend fun onPush(push: Push) {
        if (push is Push.Goodbye) {
            autoPair = false
            current?.let { tv -> paired.forget(tv.id); settings.update { if (it.lastTvId == tv.id) it.copy(lastTvId = null) else it } }
            _state.value = LinkState.Failed(current, LinkFailure.REFUSED)
            disconnect()
        }
        _events.emit(push)
    }

    /**
     * Who to connect to now: the TV the user picked; else the last TV (at its newest address);
     * else, on first run, the only TV on the network.
     */
    private suspend fun pickTarget(): TvEndpoint? {
        chosen.value?.let { c -> return found.value.firstOrNull { it.record.id == c.id }?.let { c.copy(host = it.host, port = it.port) } ?: c }
        val pairedTvs = paired.tvs.first()
        val last = settings.current().lastTvId?.let { id -> pairedTvs.firstOrNull { it.id == id } } ?: pairedTvs.firstOrNull()
        if (last != null) {
            val seen = found.value.firstOrNull { it.record.id == last.id }
            return TvEndpoint(last.id, last.name, seen?.host ?: last.host, seen?.port ?: last.port, paired = true)
        }
        if (!autoPair) return null
        return found.value.singleOrNull()?.let { TvEndpoint(it.record.id, it.record.name, it.host, it.port, paired = false) }
    }

    private suspend fun publishSearch() {
        if (_state.value is LinkState.Searching || (rpc == null && _state.value !is LinkState.Failed && _state.value !is LinkState.Reconnecting)) {
            val pairedIds = paired.tvs.first().map(PairedTv::id).toSet()
            _state.value = LinkState.Searching(found.value.map { TvEndpoint(it.record.id, it.record.name, it.host, it.port, it.record.id in pairedIds) })
        }
    }

    /** Sleeps until something could change the answer of [pickTarget]: a new scan, a choice, a retry. */
    private suspend fun waitForChange() = coroutineScope {
        val scan = async { found.drop(1).first() }
        val pick = async { chosen.first { it != null } }
        select<Unit> {
            retryNow.onAwait { }
            scan.onAwait { }
            pick.onAwait { }
        }
        coroutineContext.cancelChildren()
        retryNow = CompletableDeferred()
    }

    private suspend fun waitForRetry() { retryNow.await(); retryNow = CompletableDeferred(); autoPair = true }

    private suspend fun disconnect() {
        rpc = null; current = null; currentKey = null
        closeBulk()
        retry()
    }

    private suspend fun closeBulk() = bulkLock.withLock { bulkSocket?.close(); bulk = null; bulkSocket = null }

    private fun offline() = RemoteException(ErrorCode.UNAVAILABLE, "not connected to the TV")

    companion object {
        private const val TAG = "HubClient"
        fun selfPeer(key: IdentityKey, name: String, model: String, version: String) =
            PeerInfo(fingerprintOf(key.publicKey), name, model, DeviceRole.PHONE, version)
    }
}
