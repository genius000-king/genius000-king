package com.genius.tvhub.feature.tv.launcher

import android.app.ActivityManager
import android.content.Context
import android.os.Environment
import android.os.StatFs
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.engine.apps.AndroidAppsEngine
import com.genius.tvhub.engine.apps.install.ApkDownloader
import com.genius.tvhub.engine.apps.install.LocalApk
import com.genius.tvhub.engine.apps.install.LocalApkScanner
import com.genius.tvhub.engine.input.AccessibilityInputEngine
import com.genius.tvhub.runtime.host.HostRuntime
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/** Feeds the launcher from the device: installed apps with real icons and colours, your space, live status. */
@HiltViewModel
class LauncherViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apps: AndroidAppsEngine,
    private val settings: SettingsStore,
    private val runtime: HostRuntime,
    private val input: AccessibilityInputEngine,
) : ViewModel(), LauncherActions {

    private val catalog = MutableStateFlow<List<LauncherApp>>(emptyList())
    private val _localApks = MutableStateFlow<List<LocalApk>?>(null)
    /** APK files found on the TV when the user picks "From USB or Downloads"; null = sheet closed. */
    val localApks: StateFlow<List<LocalApk>?> = _localApks
    private val _download = MutableStateFlow<Float?>(null)
    val download: StateFlow<Float?> = _download

    private val memory = flow<Pair<Float?, Float?>> {
        val am = context.getSystemService(ActivityManager::class.java)
        while (true) {
            val m = ActivityManager.MemoryInfo().also(am::getMemoryInfo)
            val data = StatFs(Environment.getDataDirectory().path)
            emit((1f - m.availMem.toFloat() / m.totalMem) to (1f - data.availableBytes.toFloat() / data.totalBytes))
            delay(5_000)
        }
    }

    private val phone = runtime.core.flatMapLatest { it?.connected ?: flowOf(emptyList()) }.map { it.firstOrNull()?.name }

    val state: StateFlow<LauncherState> = combine(catalog, settings.settings, phone, memory.onStart { emit(null to null) }, input.ready) { all, s, phoneName, mem, _ ->
        val (ram, disk) = mem
        LauncherState(
            space = s.favorites.mapNotNull { pkg -> all.firstOrNull { it.packageName == pkg } },
            all = all,
            shortcuts = emptyList(),
            phoneName = phoneName,
            pointerOn = false,
            ramFraction = ram,
            storageFraction = disk,
            setupStepsLeft = listOf(input.ready.value, apps.canInstall()).count { !it },
            appearance = s.toAppearance(),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LauncherState())

    init {
        viewModelScope.launch { refresh() }
        viewModelScope.launch { apps.changes.collect { refresh() } }
    }

    private suspend fun refresh() {
        val sizePx = (context.resources.displayMetrics.density * 96).toInt()
        val list = withContext(Dispatchers.IO) {
            apps.catalog.apps().map { app ->
                val icon = apps.localIcon(app.packageName, sizePx)
                LauncherApp(app.packageName, app.label, icon?.bitmap?.asImageBitmap(), Color(icon?.accent ?: 0xFF8A8A8A.toInt()), app.isTvApp)
            }
        }
        catalog.value = list
        seedSpaceOnce(list)
    }

    /** First start: put up to six of your own (non-system) apps in your space, so home is never empty. */
    private suspend fun seedSpaceOnce(list: List<LauncherApp>) {
        if (settings.current().favorites.isNotEmpty()) return
        val own = apps.catalog.apps().filter { !it.isSystem }.map { it.packageName }
        val seed = (own + list.map { it.packageName }).distinct().take(6)
        if (seed.isNotEmpty()) settings.update { it.copy(favorites = seed) }
    }

    override fun launch(app: LauncherApp) { apps.launch(app.packageName) }

    override fun toggleSpace(app: LauncherApp) {
        viewModelScope.launch {
            settings.update { s -> s.copy(favorites = if (app.packageName in s.favorites) s.favorites - app.packageName else s.favorites + app.packageName) }
        }
    }

    override fun appInfo(app: LauncherApp) = apps.showInfo(app.packageName)
    override fun uninstall(app: LauncherApp) = apps.uninstall(app.packageName)

    override fun run(shortcut: HomeShortcut) {
        when (val a = shortcut.action) {
            is ShortcutAction.OpenUrl -> apps.launcher.openUrl(a.url)
            is ShortcutAction.LaunchApp -> apps.launch(a.packageName)
            ShortcutAction.TogglePointer -> viewModelScope.launch { input.cursorVisible(true) }
            ShortcutAction.OpenSettings -> Unit
        }
    }

    override fun addApp(source: AddSource) {
        when (source) {
            AddSource.FILES -> viewModelScope.launch { _localApks.value = withContext(Dispatchers.IO) { runCatching { LocalApkScanner(context).scan() }.getOrDefault(emptyList()) } }
            AddSource.PHONE, AddSource.LINK -> Unit // guided on the phone; the sheet already says how
        }
    }

    fun closeLocalApks() { _localApks.value = null }

    /** Installs an APK file found on the TV through the same streaming installer the phone uses. */
    fun installLocal(apk: LocalApk) {
        _localApks.value = null
        viewModelScope.launch(Dispatchers.IO) { installFile(apk.file) }
    }

    fun installFromLink(url: String) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val file = ApkDownloader(context).download(url) { _download.value = it }
                _download.value = null
                installFile(file)
            }.onFailure { _download.value = null }
        }
    }

    private suspend fun installFile(file: java.io.File) {
        if (!apps.canInstall()) { apps.requestInstallPermission(); return }
        val id = apps.beginInstall(file.name, listOf(file.length()))
        file.inputStream().use { input ->
            val buf = ByteArray(256 * 1024); var offset = 0L
            while (true) {
                val n = input.read(buf); if (n <= 0) break
                apps.writeInstall(id, 0, offset, buf.copyOf(n)); offset += n
            }
        }
        apps.commitInstall(id).collect { }
    }

    override fun openSettings() = Unit // navigation is handled by the activity

    private fun HubSettings.toAppearance() = Appearance(
        glow = glow, motion = motion, iconFrames = iconFrames,
        iconSize = if (largeIcons) IconSize.LARGE else IconSize.NORMAL, labels = showLabels,
        widgets = buildList { if (widgetPhone) add(WidgetKind.PHONE); if (widgetDevice) add(WidgetKind.DEVICE); if (widgetShortcuts) add(WidgetKind.SHORTCUTS) },
    )
}
