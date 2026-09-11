package io.nawah.linux

import android.app.Application
import io.nawah.linux.di.Services

class NawahApplication : Application() {

    val services: Services by lazy { Services(this) }

    override fun onCreate() {
        super.onCreate()
        // Installed before anything else: the crashes worth catching are the
        // ones during a long install, when nobody is looking at the screen.
        CrashLog.install(this)
    }
}
