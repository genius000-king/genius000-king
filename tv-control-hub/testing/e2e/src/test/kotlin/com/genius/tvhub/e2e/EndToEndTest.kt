package com.genius.tvhub.e2e

import android.content.Context
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.genius.tvhub.core.common.Clock
import com.genius.tvhub.core.data.HubDatabase
import com.genius.tvhub.core.data.PairedTvStore
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.data.TrustStore
import com.genius.tvhub.core.discovery.FoundService
import com.genius.tvhub.core.discovery.ServiceRecord
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkFailure
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.InstallState
import com.genius.tvhub.core.protocol.PROTOCOL_VERSION
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.core.security.SoftwareIdentityKey
import com.genius.tvhub.core.security.fingerprintOf
import com.genius.tvhub.core.transport.HostServer
import com.genius.tvhub.engine.input.api.FocusedField
import com.genius.tvhub.runtime.client.HubClient
import com.genius.tvhub.runtime.client.RemoteApps
import com.genius.tvhub.runtime.client.RemoteDevice
import com.genius.tvhub.runtime.client.RemoteFiles
import com.genius.tvhub.runtime.client.RemoteInput
import com.genius.tvhub.runtime.host.HostCore
import com.genius.tvhub.runtime.host.HostGatekeeper
import com.genius.tvhub.runtime.host.VideoSource
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * The whole product minus the hardware: the real TV core (gatekeeper, router, sessions, real
 * Room/DataStore) and the real phone client, over real localhost sockets. Only the engines are
 * fakes ([FakeTv]).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class EndToEndTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val clock = Clock.System

    // ---- TV ----
    private val tv = FakeTv()
    private val tvKey = SoftwareIdentityKey.generate()
    private val tvPeer = PeerInfo(fingerprintOf(tvKey.publicKey), "Living room", "TV Box S", DeviceRole.TV, "1")
    private lateinit var tvDb: HubDatabase
    private lateinit var trust: TrustStore
    private lateinit var gatekeeper: HostGatekeeper
    private lateinit var core: HostCore
    private var server: HostServer? = null
    private var port = 0

    // ---- phone ----
    private lateinit var phoneDb: HubDatabase
    private lateinit var phoneSettings: SettingsStore
    private val phoneKey = SoftwareIdentityKey.generate()
    private val discovered = MutableStateFlow<List<FoundService>>(emptyList())

    private fun settingsStore(name: String) = SettingsStore(PreferenceDataStoreFactory.create(scope = scope) { File(context.cacheDir, "$name-${System.nanoTime()}.preferences_pb") })

    @Before fun setUp() = runBlocking {
        tvDb = Room.inMemoryDatabaseBuilder(context, HubDatabase::class.java).build()
        phoneDb = Room.inMemoryDatabaseBuilder(context, HubDatabase::class.java).build()
        trust = TrustStore(tvDb.trustedDevices(), clock)
        gatekeeper = HostGatekeeper(trust, settingsStore("tv"), answerTimeoutMillis = 10_000)
        val video = object : VideoSource {
            override suspend fun ensureCapture() = true
            override fun packets(quality: StreamQuality): Flow<VideoPacket> = flow {
                emit(VideoPacket.format(1280, 720, 30, 4_000_000))
                emit(VideoPacket(VideoPacket.Kind.CONFIG, 0, 0, byteArrayOf(0, 0, 0, 1, 0x67)))
                var pts = 0L
                while (true) { emit(VideoPacket(VideoPacket.Kind.FRAME, if (pts == 0L) VideoPacket.FLAG_KEY else 0, pts, ByteArray(2_000))); pts += 33_000; delay(10) }
            }
        }
        core = HostCore(tvPeer, tvKey, gatekeeper, trust, tv.ports, video, { emptyList() }, scope)
        scope.launch { trust.devices.collect { list -> gatekeeper.update(list); core.onTrustedChanged(list.map { it.id }.toSet()) } }
        startServer(0)
        phoneSettings = settingsStore("phone")
    }

    private suspend fun startServer(requestedPort: Int) {
        server = HostServer(requestedPort, core::handle).also { it.start() }
        port = server!!.boundPort
        discovered.value = listOf(FoundService(ServiceRecord(tvPeer.id, tvPeer.name, PROTOCOL_VERSION), "127.0.0.1", port))
    }

    @After fun tearDown() {
        server?.stop(); scope.cancel(); tvDb.close(); phoneDb.close()
    }

    private fun phone(): HubClient = HubClient(
        self = PeerInfo(fingerprintOf(phoneKey.publicKey), "Galaxy", "S24", DeviceRole.PHONE, "1"),
        identity = { phoneKey },
        discovery = { discovered },
        paired = PairedTvStore(phoneDb.pairedTvs(), clock),
        settings = phoneSettings,
    ).also { it.start(scope) }

    private suspend fun HubClient.awaitState(timeout: Long = 15_000, predicate: (LinkState) -> Boolean): LinkState =
        withTimeout(timeout) { state.first(predicate) }

    /** First run: nothing to tap on the phone, one OK on the TV. */
    private suspend fun pairFirstTime(): HubClient {
        val p = phone()
        val waiting = p.awaitState { it is LinkState.AwaitingApproval } as LinkState.AwaitingApproval
        val request = withTimeout(5_000) { gatekeeper.request.first { it != null } }!!
        assertThat(request.code).isEqualTo(waiting.code)
        assertThat(request.peer.name).isEqualTo("Galaxy")
        gatekeeper.approve()
        p.awaitState { it is LinkState.Connected }
        return p
    }

    @Test fun firstRunPairsWithOneOkThenReconnectsSilentlyForever() = runBlocking {
        pairFirstTime()
        assertThat(trust.get(fingerprintOf(phoneKey.publicKey))).isNotNull()

        // App restarted: a fresh client with the same stored data connects with no prompt.
        val again = phone()
        val connected = again.awaitState { it is LinkState.Connected } as LinkState.Connected
        assertThat(connected.tv.paired).isTrue()
        assertThat(gatekeeper.request.value).isNull()
    }

    @Test fun refusalOnTheTvIsShownOnThePhone() = runBlocking {
        val p = phone()
        p.awaitState { it is LinkState.AwaitingApproval }
        withTimeout(5_000) { gatekeeper.request.first { it != null } }
        gatekeeper.deny()
        val failed = p.awaitState { it is LinkState.Failed } as LinkState.Failed
        assertThat(failed.failure).isEqualTo(LinkFailure.REFUSED)
    }

    @Test fun remoteKeysAndTextReachTheTv() = runBlocking {
        val p = pairFirstTime()
        val input = RemoteInput(p)
        input.key(KeyAction.DOWN); input.key(KeyAction.CENTER); input.text("hello")
        assertThat(tv.log).containsAtLeast("key:DOWN", "key:CENTER", "text:hello").inOrder()
    }

    @Test fun focusedTextFieldOpensThePhoneKeyboard() = runBlocking {
        val p = pairFirstTime()
        val input = RemoteInput(p)
        val focus = scope.async { withTimeout(5_000) { input.focus.first() } }
        delay(200)
        tv.focus.value = FocusedField("abc", "Search", false)
        val push = focus.await()
        assertThat(push.focused).isTrue()
        assertThat(push.hint).isEqualTo("Search")
    }

    @Test fun filesTravelBothWaysOnTheBulkChannel() = runBlocking {
        val p = pairFirstTime()
        val files = RemoteFiles(p)
        val data = ByteArray(700_000) { (it * 7).toByte() }
        var progress = 0f
        files.upload(ByteArrayInputStream(data), data.size.toLong(), RemotePath("app", "movie.bin")) { progress = it }
        assertThat(progress).isEqualTo(1f)
        assertThat(tv.files["movie.bin"]).isEqualTo(data)
        val out = ByteArrayOutputStream()
        files.download(RemotePath("app", "movie.bin"), out)
        assertThat(out.toByteArray()).isEqualTo(data)
    }

    @Test fun liveMetricsStreamWhileWatched() = runBlocking {
        val p = pairFirstTime()
        val snapshots = withTimeout(5_000) { RemoteDevice(p).metrics().take(3).toList() }
        assertThat(snapshots).hasSize(3)
        assertThat(snapshots.first().memory.totalBytes).isEqualTo(2048)
    }

    @Test fun appBeamInstallsSplitsAndReportsSuccess() = runBlocking {
        val p = pairFirstTime()
        val base = ByteArray(300_000) { 1 }; val split = ByteArray(10_000) { 2 }
        val state = RemoteApps(p).install("Brave", listOf(base.size.toLong() to { ByteArrayInputStream(base) }, split.size.toLong() to { ByteArrayInputStream(split) }))
        assertThat(state).isEqualTo(InstallState.SUCCESS)
        assertThat(tv.installs["inst-1"]!![0]).isEqualTo(base)
        assertThat(tv.installs["inst-1"]!![1]).isEqualTo(split)
    }

    @Test fun liveScreenPacketsArrive() = runBlocking {
        val p = pairFirstTime()
        val packets = withTimeout(5_000) { p.video(StreamQuality.BALANCED).take(5).toList() }
        assertThat(packets.first().kind).isEqualTo(VideoPacket.Kind.FORMAT)
        assertThat(packets[2].isKeyFrame).isTrue()
    }

    @Test fun revokingOnTheTvCutsThePhoneOff() = runBlocking {
        val p = pairFirstTime()
        trust.revoke(fingerprintOf(phoneKey.publicKey))
        val failed = p.awaitState { it is LinkState.Failed } as LinkState.Failed
        assertThat(failed.failure).isEqualTo(LinkFailure.REFUSED)
    }

    @Test fun permissionSwitchOnTheTvAppliesImmediately() = runBlocking {
        val p = pairFirstTime()
        val id = fingerprintOf(phoneKey.publicKey)
        trust.setGrants(id, trust.get(id)!!.grants - Grant.INPUT)
        delay(300)
        val e = runCatching { RemoteInput(p).key(KeyAction.UP) }.exceptionOrNull()
        assertThat(e).hasMessageThat().contains("input")
    }

    @Test fun tvRestartIsHealedWithoutTheUser() = runBlocking {
        val p = pairFirstTime()
        server!!.stop()
        p.awaitState { it is LinkState.Reconnecting }
        startServer(port)
        p.awaitState(timeout = 30_000) { it is LinkState.Connected }
        RemoteInput(p).key(KeyAction.HOME)
        assertThat(tv.log).contains("key:HOME")
    }
}

