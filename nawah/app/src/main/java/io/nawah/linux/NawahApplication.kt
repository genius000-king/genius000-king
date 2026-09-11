package io.nawah.linux

import android.app.Application
import io.nawah.linux.di.Services

class NawahApplication : Application() {
    val services: Services by lazy { Services(this) }
}
