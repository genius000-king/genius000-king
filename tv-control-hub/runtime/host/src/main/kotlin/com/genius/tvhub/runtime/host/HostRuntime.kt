package com.genius.tvhub.runtime.host

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.genius.tvhub.core.data.IdentityStore
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.data.TrustStore
import com.genius.tvhub.core.discovery.NsdAdvertiser
import com.genius.tvhub.core.discovery.ServiceRecord
import com.genius.tvhub.core.model.Capability
import com.genius.tvhub.core.model.CapabilityCheck
import com.genius.tvhub.core.model.CheckState
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.PROTOCOL_VERSION
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.core.security.fingerprintOf
import com.genius.tvhub.core.transport.HostServer
import com.genius.tvhub.engine.stream.StreamEngine
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The TV side on a real device: [HostCore] plus the listening socket, the mDNS announcement and
 * the screen encoder. Lives in [HostService].
 */
@Singleton
class HostRuntime @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settings: SettingsStore,
    private val trust: TrustStore,
    private val identity: IdentityStore,
    private val ports: HostPorts,
    private val stream: StreamEngine,
    private val adb: AdbBridge,
) {
    val gatekeeper = HostGatekeeper(trust, settings)
    private val _core = MutableStateFlow<HostCore?>(null)
    val core: StateFlow<HostCore?> = _core

    /** Set by the service: shows the capture prompt and promotes the service. True if granted. */
    var projectionRequester: (suspend () -> Boolean)? = null

    private var server: HostServer? = null
    private val advertiser = NsdAdvertiser(context)
    private var job: Job? = null

    /** ADB mode when connected (no prompt, works where the capture dialog is missing), else MediaProjection. */
    private val video = object : VideoSource {
        override suspend fun ensureCapture() = adb.ready || stream.projection.active.value || (projectionRequester?.invoke() ?: false)
        override fun packets(quality: StreamQuality): Flow<VideoPacket> =
            if (adb.ready && !stream.projection.active.value) displaySize().let { (w, h) -> adb.packets(w, h, quality) } else stream.packets(quality)
        override fun reportQueue(queued: Int, nowMillis: Long) = stream.reportQueue(queued, nowMillis)
    }

    private fun displaySize(): Pair<Int, Int> = if (Build.VERSION.SDK_INT >= 30) {
        context.getSystemService(android.view.WindowManager::class.java).maximumWindowMetrics.bounds.let { it.width() to it.height() }
    } else context.resources.displayMetrics.let { it.widthPixels to it.heightPixels }

    suspend fun start(scope: CoroutineScope) {
        if (job != null) return
        val key = identity.key
        val self = PeerInfo(fingerprintOf(key.publicKey), deviceName(), "${Build.MANUFACTURER} ${Build.MODEL}", DeviceRole.TV, VERSION)
        val core = HostCore(self, key, gatekeeper, trust, ports, video, ::checks, scope)
        _core.value = core
        adb.start(scope)
        job = scope.launch {
            launch { trust.devices.collect { list -> gatekeeper.update(list); core.onTrustedChanged(list.map { it.id }.toSet()) } }
            val s = HostServer(HostServer.DEFAULT_PORT, core::handle)
            s.start()
            server = s
            advertiser.start(ServiceRecord(self.id, self.name, PROTOCOL_VERSION), s.boundPort)
        }
    }

    suspend fun stop() {
        advertiser.stop()
        server?.stop(); server = null
        job?.cancelAndJoin(); job = null
        _core.value = null
    }

    fun checks(): List<CapabilityCheck> = buildList {
        add(CapabilityCheck(Capability.ACCESSIBILITY, if (ports.input.ready.value) CheckState.OK else CheckState.MISSING))
        add(CapabilityCheck(Capability.DPAD_ACTIONS, if (Build.VERSION.SDK_INT >= 33) CheckState.OK else CheckState.UNSUPPORTED))
        add(CapabilityCheck(Capability.SCREEN_CAPTURE, if (stream.projection.active.value) CheckState.OK else CheckState.MISSING, "granted per session"))
        add(CapabilityCheck(Capability.INSTALL_PACKAGES, if (ports.apps.canInstall()) CheckState.OK else CheckState.MISSING))
        addAll(ports.monitor.checks())
    }

    private suspend fun deviceName(): String = settings.current().tvName
        ?: Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)
        ?: Build.MODEL

    companion object { const val VERSION = "0.1.0" }
}
