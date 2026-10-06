package com.genius.imlaq

import android.app.Application
import android.content.Context
import com.genius.imlaq.device.DeviceProfiler
import com.genius.imlaq.device.MemoryWatcher
import com.genius.imlaq.engine.host.Runner
import com.genius.imlaq.engine.host.RunnerBinaries
import com.genius.imlaq.engine.host.moe.MoeTextEngine
import com.genius.imlaq.memory.MemoryPlanner
import com.genius.imlaq.models.ModelStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

class ImlaqApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

/**
 * Hand-wired dependencies: one place that builds every long-lived object. Small enough that a DI
 * framework would cost more than it saves.
 */
class AppContainer(context: Context) {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val deviceProfiler = DeviceProfiler(context)
    val memoryWatcher = MemoryWatcher(context)
    val memoryPlanner = MemoryPlanner()

    /** Internal storage on purpose: O_DIRECT expert reads need a real filesystem, not /sdcard. */
    val modelsDir: File = File(context.filesDir, "models").apply { mkdirs() }
    val modelStore = ModelStore(modelsDir)

    val runners: RunnerBinaries by lazy { RunnerBinaries(context) }

    val textEngine: MoeTextEngine by lazy {
        MoeTextEngine(
            executable = runners.executable(Runner.TEXT),
            libraryDir = runners.libraryDir,
            workDir = File(context.cacheDir, "engine").apply { mkdirs() },
            scope = appScope,
        )
    }

    val settings = Settings(context)
}

class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    private val _darkTheme = MutableStateFlow(prefs.getBoolean(KEY_DARK, true))
    val darkTheme: StateFlow<Boolean> = _darkTheme

    fun setDarkTheme(dark: Boolean) {
        prefs.edit().putBoolean(KEY_DARK, dark).apply()
        _darkTheme.value = dark
    }

    private companion object {
        const val KEY_DARK = "dark_theme"
    }
}
