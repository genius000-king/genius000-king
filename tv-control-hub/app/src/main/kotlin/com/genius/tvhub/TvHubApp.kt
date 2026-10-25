package com.genius.tvhub

import android.app.Application
import android.content.Context
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.common.LogSink
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.engine.input.AccessibilityInputEngine
import com.genius.tvhub.engine.input.api.InputPrefs
import com.genius.tvhub.runtime.client.HubClient
import com.genius.tvhub.runtime.host.HostService
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Starts the side this device plays: the TV host service, or the phone's connection. */
@HiltAndroidApp
class TvHubApp : Application() {
    @Inject lateinit var settings: SettingsStore
    @Inject lateinit var hub: HubClient
    @Inject lateinit var input: AccessibilityInputEngine

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var role: DeviceRole
        private set

    override fun attachBaseContext(base: Context) = super.attachBaseContext(LocaleStore.wrap(base))

    override fun onCreate() {
        super.onCreate()
        Log.sink = LogSink { level, tag, message, error ->
            when (level) {
                Log.Level.DEBUG -> android.util.Log.d(tag, message, error)
                Log.Level.INFO -> android.util.Log.i(tag, message, error)
                Log.Level.WARN -> android.util.Log.w(tag, message, error)
                Log.Level.ERROR -> android.util.Log.e(tag, message, error)
            }
        }
        role = RoleDetector.detect(this)
        when (role) {
            DeviceRole.TV -> {
                RoleDetector.enableTvHome(this)
                runCatching { HostService.start(this) }
                // Input settings live in DataStore; the accessibility service reads them from here.
                scope.launch {
                    settings.settings.collect { s ->
                        input.configure(InputPrefs(s.remoteMouseLongPress, s.autoMouseForPhoneApps, s.launcherTakesHome, "$packageName/$packageName.MainActivity"))
                    }
                }
            }
            DeviceRole.PHONE -> hub.start(scope)
        }
        scope.launch { settings.settings.collect { LocaleStore.save(this@TvHubApp, it.language) } }
    }

    suspend fun startOnBoot() = settings.settings.first().startOnBoot
}
