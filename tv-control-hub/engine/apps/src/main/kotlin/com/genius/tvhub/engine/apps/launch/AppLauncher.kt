package com.genius.tvhub.engine.apps.launch

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

/** Opens apps the right way for a TV: the TV (leanback) entry first, the phone entry otherwise. */
class AppLauncher(private val context: Context) {
    private val pm = context.packageManager

    fun launch(packageName: String): Boolean {
        val intent = pm.getLeanbackLaunchIntentForPackage(packageName) ?: pm.getLaunchIntentForPackage(packageName) ?: return false
        return runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)) }.isSuccess
    }

    fun uninstall(packageName: String) {
        runCatching { context.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$packageName")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    fun showInfo(packageName: String) {
        runCatching { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    fun openUrl(url: String): Boolean =
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.isSuccess
}
