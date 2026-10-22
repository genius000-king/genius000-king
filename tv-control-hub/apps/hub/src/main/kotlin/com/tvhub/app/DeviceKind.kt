package com.tvhub.app

import android.app.UiModeManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration

/** The interface a device gets. One APK serves both kinds of device, and this decides which one runs. */
enum class DeviceKind {
    Phone,
    Tv;

    companion object {
        /** The decision itself, free of Android objects, so it can be tested on the JVM. */
        fun from(uiModeType: Int, hasLeanbackFeature: Boolean): DeviceKind =
            if (uiModeType == Configuration.UI_MODE_TYPE_TELEVISION || hasLeanbackFeature) Tv else Phone

        fun detect(context: Context): DeviceKind {
            val uiModeType = context.getSystemService(UiModeManager::class.java).currentModeType
            val hasLeanback = context.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
            return from(uiModeType, hasLeanback)
        }
    }
}
