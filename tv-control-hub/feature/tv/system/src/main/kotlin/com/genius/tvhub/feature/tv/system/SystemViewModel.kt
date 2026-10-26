package com.genius.tvhub.feature.tv.system

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.data.ServiceStore
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.data.TrustStore
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.ServiceState
import com.genius.tvhub.core.security.shortFingerprint
import com.genius.tvhub.core.transport.HostServer
import com.genius.tvhub.engine.apps.AndroidAppsEngine
import com.genius.tvhub.engine.files.FilesEngine
import com.genius.tvhub.engine.input.AccessibilityInputEngine
import com.genius.tvhub.engine.adb.api.AdbState
import com.genius.tvhub.runtime.host.AdbBridge
import com.genius.tvhub.runtime.host.HostRuntime
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.net.NetworkInterface
import javax.inject.Inject

@HiltViewModel
class SystemViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settings: SettingsStore,
    private val trust: TrustStore,
    private val services: ServiceStore,
    private val runtime: HostRuntime,
    private val apps: AndroidAppsEngine,
    private val files: FilesEngine,
    private val input: AccessibilityInputEngine,
    private val adb: AdbBridge,
) : ViewModel(), SystemActions {

    /** Setup checks change outside the app (in Android settings): re-read every two seconds while shown. */
    private val setupTicker = combine(flow { while (true) { emit(Unit); delay(2_000) } }, adb.state) { _, a -> setupItems(a) }

    val state: StateFlow<SystemState> = combine(
        settings.settings, trust.devices, runtime.core.let { core -> combine(core, input.ready) { c, _ -> c } }, setupTicker, services.services,
    ) { s, devices, core, setup, specs ->
        val connected = core?.connected?.value.orEmpty().map { it.id }.toSet()
        SystemState(
            settings = s,
            phones = devices.map { PhoneRow(it.id, it.name, it.model, it.grants, it.id in connected) },
            setup = setup,
            services = specs.map { ServiceRow(it.name, ServiceState.UNKNOWN) },
            version = HostRuntime.VERSION,
            fingerprint = core?.self?.id?.let(::shortFingerprint).orEmpty(),
            address = addresses().joinToString("  ·  ") { "$it:${HostServer.DEFAULT_PORT}" },
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SystemState())

    override fun update(change: (HubSettings) -> HubSettings) { viewModelScope.launch { settings.update(change) } }

    override fun setGrant(phoneId: String, grant: Grant, on: Boolean) {
        viewModelScope.launch {
            val d = trust.get(phoneId) ?: return@launch
            trust.setGrants(phoneId, if (on) d.grants + grant else d.grants - grant)
        }
    }

    override fun revoke(phoneId: String) { viewModelScope.launch { trust.revoke(phoneId) } }

    override fun setLanguage(language: AppLanguage) = update { it.copy(language = language) }

    override fun openSetup(kind: SetupKind) {
        if (kind == SetupKind.ADB) {
            // Network ADB off: open developer options, where "USB debugging" turns it on.
            if ((adb.state.value as? AdbState.Unavailable)?.reason == AdbState.Reason.PORT_CLOSED) {
                runCatching { context.startActivity(Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
            adb.enable()
            return
        }
        val intent = when (kind) {
            SetupKind.ADB -> return
            SetupKind.ACCESSIBILITY -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            SetupKind.INSTALL -> Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            SetupKind.FILES -> if (Build.VERSION.SDK_INT >= 30) Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${context.packageName}")) else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            SetupKind.HOME -> Intent(Settings.ACTION_HOME_SETTINGS)
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        // TV builds often lack some settings screens: fall back to the app's own page.
        runCatching { context.startActivity(intent) }.onFailure {
            runCatching { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }

    private fun setupItems(a: AdbState) = listOf(
        SetupItem(SetupKind.ADB, a == AdbState.Ready, noteOf(a)),
        SetupItem(SetupKind.ACCESSIBILITY, input.ready.value),
        SetupItem(SetupKind.INSTALL, apps.canInstall()),
        SetupItem(SetupKind.FILES, files.roots.sharedAllowed()),
        SetupItem(SetupKind.HOME, isDefaultHome()),
    )

    private fun noteOf(a: AdbState): AdbNote? = when (a) {
        AdbState.Connecting -> AdbNote.CONNECTING
        AdbState.AwaitingApproval -> AdbNote.APPROVE_ON_TV
        is AdbState.Unavailable -> when (a.reason) {
            AdbState.Reason.PORT_CLOSED -> AdbNote.PORT_CLOSED
            AdbState.Reason.NOT_APPROVED -> AdbNote.NOT_APPROVED
            AdbState.Reason.FAILED -> AdbNote.FAILED
        }
        else -> null
    }

    private fun isDefaultHome(): Boolean {
        val home = context.packageManager.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
        return home?.activityInfo?.packageName == context.packageName
    }

    private fun addresses(): List<String> = runCatching {
        NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }
            .flatMap { it.inetAddresses.toList() }.mapNotNull { it.hostAddress }.filter { '.' in it && !it.startsWith("127.") }
    }.getOrDefault(emptyList())
}

@HiltViewModel
class PairingViewModel @Inject constructor(private val runtime: HostRuntime) : ViewModel() {
    val request = runtime.gatekeeper.request
    fun allow() = runtime.gatekeeper.approve()
    fun deny() = runtime.gatekeeper.deny()
}

