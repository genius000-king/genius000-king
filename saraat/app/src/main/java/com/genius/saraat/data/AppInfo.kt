package com.genius.saraat.data

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import java.util.concurrent.ConcurrentHashMap

class AppEntry(val packageName: String, val label: String)

/** Resolves app names from the Linux uids that the engine reports. */
object AppInfo {
    private val labels = ConcurrentHashMap<Int, String>()

    fun label(context: Context, uid: Int): String = labels.getOrPut(uid) {
        val pm = context.packageManager
        when {
            uid == UID_DEVICE -> "كل الجهاز"
            uid < 0 -> "غير معروف"
            uid == 1000 -> "نظام أندرويد"
            else -> pm.getPackagesForUid(uid)?.firstOrNull()?.let { pkg ->
                runCatching { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() }.getOrDefault(pkg)
            } ?: if (uid < 10000) "خدمات النظام" else "تطبيق محذوف"
        }
    }

    fun packageFor(context: Context, uid: Int): String? =
        if (uid < 0) null else context.packageManager.getPackagesForUid(uid)?.firstOrNull()

    /** Apps that have a launcher icon, sorted by name. Needs the <queries> entry in the manifest. */
    fun launchableApps(context: Context): List<AppEntry> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(intent, PackageManager.MATCH_ALL)
            .map { AppEntry(it.activityInfo.packageName, it.loadLabel(pm).toString()) }
            .filter { it.packageName != context.packageName }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }
}
