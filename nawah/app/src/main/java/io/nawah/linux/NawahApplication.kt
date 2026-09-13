package io.nawah.linux

import android.app.Application
import android.content.Context
import io.nawah.linux.di.Services
import io.nawah.linux.settings.AppSettings
import io.nawah.linux.settings.LocaleWrapper

class NawahApplication : Application() {

    val services: Services by lazy { Services(this) }

    /** Read once at process start; the app is recreated when it changes. */
    val settings: AppSettings by lazy { AppSettings(this) }

    // Notifications from the installer and the session service resolve their
    // strings against this context, so the language choice has to reach it too
    // -- wrapping only the Activity looks right until a notification appears.
    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(LocaleWrapper.wrap(base))
    }

    override fun onCreate() {
        super.onCreate()
        // Installed before anything else: the crashes worth catching are the
        // ones during a long install, when nobody is looking at the screen.
        CrashLog.install(this)
    }
}
