package com.genius.tvhub.engine.apps.beam

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import java.io.File

/** A phone app that can be sent to the TV: its base APK and any split APKs. */
data class BeamableApp(val packageName: String, val label: String, val files: List<File>, val isSystem: Boolean) {
    val totalBytes get() = files.sumOf { it.length() }
}

/**
 * Phone side of "send this app to my TV". Installed APK files are world-readable, so no
 * permission is needed; splits are sent too, so modern split apps install complete.
 */
class PhoneApkSource(private val context: Context) {
    fun apps(): List<BeamableApp> {
        val pm = context.packageManager
        return pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
            .map { it.activityInfo.applicationInfo }
            .distinctBy { it.packageName }
            .filter { it.packageName != context.packageName }
            .mapNotNull { info ->
                val files = (listOf(info.sourceDir) + (info.splitSourceDirs?.toList() ?: emptyList())).map(::File)
                if (files.any { !it.canRead() }) return@mapNotNull null
                BeamableApp(info.packageName, pm.getApplicationLabel(info).toString(), files, info.flags and ApplicationInfo.FLAG_SYSTEM != 0)
            }
            .sortedBy { it.label.lowercase() }
    }
}
