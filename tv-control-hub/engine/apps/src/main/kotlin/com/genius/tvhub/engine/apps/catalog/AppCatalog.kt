package com.genius.tvhub.engine.apps.catalog

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import java.io.File

/** Reads launchable apps from PackageManager; the merging rules live in [CatalogMerger]. */
class AppCatalog(private val context: Context) {
    private val pm = context.packageManager

    fun apps(hidden: Set<String> = setOf(context.packageName)): List<CatalogApp> =
        CatalogMerger.merge(query(Intent.CATEGORY_LEANBACK_LAUNCHER), query(Intent.CATEGORY_LAUNCHER), hidden)

    fun appInfo(packageName: String): ApplicationInfo? = runCatching { pm.getApplicationInfo(packageName, 0) }.getOrNull()

    fun versionName(packageName: String): String? = runCatching { pm.getPackageInfo(packageName, 0).versionName }.getOrNull()

    fun installedAt(packageName: String): Long = runCatching { pm.getPackageInfo(packageName, 0).firstInstallTime }.getOrDefault(0)

    fun sizeOf(info: ApplicationInfo): Long = (listOf(info.sourceDir) + (info.splitSourceDirs?.toList() ?: emptyList()))
        .sumOf { runCatching { File(it).length() }.getOrDefault(0L) }

    private fun query(category: String): List<LaunchEntry> =
        pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(category), PackageManager.MATCH_ALL).map { it.toEntry() }

    private fun ResolveInfo.toEntry(): LaunchEntry {
        val app = activityInfo.applicationInfo
        val system = app.flags and ApplicationInfo.FLAG_SYSTEM != 0 && app.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP == 0
        return LaunchEntry(activityInfo.packageName, loadLabel(pm).toString(), system)
    }
}
