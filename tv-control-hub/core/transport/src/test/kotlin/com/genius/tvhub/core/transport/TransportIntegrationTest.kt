package com.genius.tvhub.core.transport

import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.Channel
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.PROTOCOL_VERSION
import com.genius.tvhub.core.protocol.Push
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.core.protocol.Reply
import com.genius.tvhub.core.security.Gatekeeper
import com.genius.tvhub.core.security.Handshaker
import com.genius.tvhub.core.security.SoftwareIdentityKey
import com.genius.tvhub.core.security.fingerprintOf
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.util.Collections

/** Real Ktor server and client on localhost, real handshake, real RPC. */
class TransportIntegrationTest {
    private val tvKey = SoftwareIdentityKey.generate()
    private val tvPeer = PeerInfo(fingerprintOf(tvKey.publicKey), "TV", "box", DeviceRole.TV, "1")
    private val phoneKey = SoftwareIdentityKey.generate()
    private val phonePeer = PeerInfo(fingerprintOf(phoneKey.publicKey), "Phone", "s24", DeviceRole.PHONE, "1")

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val trusted = Collections.synchronizedMap(mutableMapOf<String, Grants>())
    private val handled = Collections.synchronizedList(mutableListOf<Call>())
    private val serverPushReady = CompletableDeferred<RpcServer>()
    private lateinit var server: HostServer
    private val connector = HubConnector()

    private val gate = object : Gatekeeper {
        override fun check(peer: PeerInfo, identityKey: ByteArray) =
            trusted[peer.id]?.let { Gatekeeper.Verdict.Trusted(it) } ?: Gatekeeper.Verdict.Unknown
        override suspend fun requestApproval(peer: PeerInfo, identityKey: ByteArray, sas: String): Gatekeeper.Verdict {
            trusted[peer.id] = Grants.DEFAULT
            return Gatekeeper.Verdict.Trusted(Grants.DEFAULT)
        }
    }

    @Before fun start() = runBlocking {
        server = HostServer(0) { incoming ->
            val session = Handshaker(tvPeer, tvKey, PROTOCOL_VERSION).accept(incoming.pipe, gate, Channel.CONTROL.name)
            val rpc = RpcServer(session, scope)
            serverPushReady.complete(rpc)
            rpc.run { call ->
                handled += call
                when (call) {
                    is Call.Ping -> Reply.Pong(call.sentAt, 99)
                    is Call.ListApps -> throw RemoteException(ErrorCode.UNAVAILABLE, "no apps today")
                    is Call.RunCommand -> { delay(5_000); Reply.Ok }
                    else -> Reply.Ok
                }
            }
        }
        server.start()
    }

    @After fun stop() {
        server.stop(); connector.close(); scope.cancel()
    }

    private suspend fun connect(channel: Channel = Channel.CONTROL, pinned: ByteArray? = null): RpcClient {
        val socket = connector.open("127.0.0.1", server.boundPort, channel)
        val session = Handshaker(phonePeer, phoneKey, PROTOCOL_VERSION).connect(socket.pipe, channel.name, pinned)
        return RpcClient(session).also { scope.launch { it.run() } }
    }

    @Test fun pairsThenCallsOverRealSockets() = runBlocking {
        val rpc = connect()
        val pong = rpc.call(Call.Ping(7)) as Reply.Pong
        assertThat(pong.sentAt).isEqualTo(7)
        assertThat(trusted).containsKey(phonePeer.id)
    }

    @Test fun typedErrorsCrossTheWire() = runBlocking {
        val rpc = connect()
        val e = runCatching { rpc.call(Call.ListApps) }.exceptionOrNull() as RemoteException
        assertThat(e.code).isEqualTo(ErrorCode.UNAVAILABLE)
        assertThat(e.message).isEqualTo("no apps today")
    }

    @Test fun pushesArriveAsEvents() = runBlocking {
        val rpc = connect()
        rpc.call(Call.Ping(1))
        val waiting = scope.launch { }
        val received = CompletableDeferred<Push>()
        scope.launch { received.complete(rpc.events.first()) }
        delay(100)
        serverPushReady.await().push(Push.Goodbye("revoked"))
        assertThat(withTimeout(3_000) { received.await() }).isEqualTo(Push.Goodbye("revoked"))
        waiting.cancel()
    }

    @Test fun inputKeepsOrderWhileSlowCommandRuns() = runBlocking {
        val rpc = connect()
        scope.launch { runCatching { rpc.call(Call.RunCommand(com.genius.tvhub.core.model.ShellBackend.SANDBOX, "sleep"), 10_000) } }
        delay(100)
        val keys = KeyAction.entries.take(8)
        keys.forEach { rpc.call(Call.Key(it)) } // each must answer while the command is still running
        val order = handled.filterIsInstance<Call.Key>().map { it.action }
        assertThat(order).containsExactlyElementsIn(keys).inOrder()
    }

    @Test fun timeoutIsTyped() = runBlocking {
        val rpc = connect()
        val e = runCatching { rpc.call(Call.RunCommand(com.genius.tvhub.core.model.ShellBackend.SANDBOX, "x"), 300) }.exceptionOrNull() as RemoteException
        assertThat(e.code).isEqualTo(ErrorCode.TIMEOUT)
    }

    @Test fun reconnectAfterPairingIsSilentAndPinned() = runBlocking {
        connect().call(Call.Ping(1))
        // Second connection pins the TV key it learned; the gate already trusts the phone.
        val again = connect(pinned = tvKey.publicKey)
        assertThat((again.call(Call.Ping(2)) as Reply.Pong).sentAt).isEqualTo(2)
    }

    @Test fun largeBinaryPayloadSurvives() = runBlocking {
        val rpc = connect()
        val chunk = ByteArray(256 * 1024) { it.toByte() }
        rpc.call(Call.UploadChunk("t", 0, chunk))
        val got = handled.filterIsInstance<Call.UploadChunk>().single()
        assertThat(got.data).isEqualTo(chunk)
    }
}

class BackoffTest {
    @Test fun growsThenCaps() {
        val b = Backoff(baseMillis = 500, maxMillis = 15_000, random = kotlin.random.Random(1))
        val delays = List(10) { b.next() }
        assertThat(delays.first()).isAtMost(600)
        assertThat(delays.last()).isAtMost(15_000)
        assertThat(delays.last()).isAtLeast(11_000)
        assertThat(delays[3]).isGreaterThan(delays[0])
        b.reset()
        assertThat(b.next()).isAtMost(600)
    }
}
