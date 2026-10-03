package com.genius.saraat.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.genius.saraat.data.Prefs

/** After a reboot (or an app update) bring back monitoring and, if it was on, the limit. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // The receiver is exported for the system's broadcasts; ignore anything else another app might send.
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        Prefs.init(context)
        val s = Prefs.current
        if (s.bootStart && (s.keepLogging || s.limitEnabled)) SaratService.apply(context)
    }
}
