package com.genius.saraat

import android.app.Application
import com.genius.saraat.data.Prefs

class SaratApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
    }
}
