package com.genius.saraat.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Which apps the speed limit applies to. */
enum class AppMode {
    /** Every app on the device. */
    ALL,

    /** Only the apps in [Settings.apps]. */
    ONLY,

    /** Every app except the ones in [Settings.apps]. */
    EXCEPT,
}

data class Settings(
    val limitEnabled: Boolean = false,
    val downKbps: Int = 1000,
    val separateUpload: Boolean = false,
    val upKbps: Int = 1000,
    val appMode: AppMode = AppMode.ALL,
    val apps: Set<String> = emptySet(),
    /** Refuse QUIC (UDP/443) so browsers fall back to TCP, which can be limited precisely. */
    val blockQuic: Boolean = true,
    /** Keep a light background service running so usage is logged even while no limit is active. */
    val keepLogging: Boolean = true,
    val bootStart: Boolean = false,
    val retentionDays: Int = 30,
    /** Auto-off timer length chosen by the user (0 = none). */
    val timerMinutes: Int = 0,
    /** Wall-clock time when the running limit switches itself off (0 = no timer running). */
    val timerEndsAt: Long = 0L,
) {
    val effectiveUpKbps: Int get() = if (separateUpload) upKbps else downKbps

    /** True when the chosen app selection can actually be applied. */
    val appsValid: Boolean get() = appMode == AppMode.ALL || apps.isNotEmpty() || appMode == AppMode.EXCEPT
}

/** Tiny SharedPreferences wrapper that exposes the settings as a [StateFlow] for Compose. */
object Prefs {
    private lateinit var sp: SharedPreferences
    private val flow = MutableStateFlow(Settings())

    val state: StateFlow<Settings> get() = flow
    val current: Settings get() = flow.value

    @Synchronized
    fun init(context: Context) {
        if (::sp.isInitialized) return
        sp = context.applicationContext.getSharedPreferences("saraat", Context.MODE_PRIVATE)
        flow.value = read()
    }

    @Synchronized
    fun update(change: Settings.() -> Settings) {
        val next = flow.value.change()
        flow.value = next
        write(next)
    }

    private fun read() = Settings(
        limitEnabled = sp.getBoolean("limitEnabled", false),
        downKbps = sp.getInt("downKbps", 1000),
        separateUpload = sp.getBoolean("separateUpload", false),
        upKbps = sp.getInt("upKbps", 1000),
        appMode = runCatching { AppMode.valueOf(sp.getString("appMode", "ALL")!!) }.getOrDefault(AppMode.ALL),
        apps = sp.getStringSet("apps", emptySet()) ?: emptySet(),
        blockQuic = sp.getBoolean("blockQuic", true),
        keepLogging = sp.getBoolean("keepLogging", true),
        bootStart = sp.getBoolean("bootStart", false),
        retentionDays = sp.getInt("retentionDays", 30),
        timerMinutes = sp.getInt("timerMinutes", 0),
        timerEndsAt = sp.getLong("timerEndsAt", 0L),
    )

    private fun write(s: Settings) {
        sp.edit()
            .putBoolean("limitEnabled", s.limitEnabled)
            .putInt("downKbps", s.downKbps)
            .putBoolean("separateUpload", s.separateUpload)
            .putInt("upKbps", s.upKbps)
            .putString("appMode", s.appMode.name)
            .putStringSet("apps", HashSet(s.apps))
            .putBoolean("blockQuic", s.blockQuic)
            .putBoolean("keepLogging", s.keepLogging)
            .putBoolean("bootStart", s.bootStart)
            .putInt("retentionDays", s.retentionDays)
            .putInt("timerMinutes", s.timerMinutes)
            .putLong("timerEndsAt", s.timerEndsAt)
            .apply()
    }
}
