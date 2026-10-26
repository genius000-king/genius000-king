package com.genius.tvhub.engine.input.service

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings
import com.genius.tvhub.core.common.Log

/**
 * Turns TV Hub's accessibility service back on by itself. Android may switch it off after an
 * app update or a crash; once ADB mode granted WRITE_SECURE_SETTINGS, nobody has to walk into
 * the accessibility menu again.
 */
object SelfEnable {
    fun ensure(context: Context): Boolean {
        if (context.checkSelfPermission(Manifest.permission.WRITE_SECURE_SETTINGS) != PackageManager.PERMISSION_GRANTED) return false
        val ours = ComponentName(context, HubAccessibilityService::class.java).flattenToString()
        val resolver = context.contentResolver
        val current = Settings.Secure.getString(resolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
        val list = current.split(':').filter { it.isNotBlank() }
        if (list.any { it.equals(ours, ignoreCase = true) } && Settings.Secure.getInt(resolver, Settings.Secure.ACCESSIBILITY_ENABLED, 0) == 1) return true
        return runCatching {
            Settings.Secure.putString(resolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, (list + ours).distinct().joinToString(":"))
            Settings.Secure.putInt(resolver, Settings.Secure.ACCESSIBILITY_ENABLED, 1)
            Log.i("SelfEnable", "accessibility service re-enabled")
            true
        }.getOrDefault(false)
    }
}
