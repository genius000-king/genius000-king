package com.genius.saraat.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.genius.saraat.data.Prefs

/** After a reboot (or an app update) bring back monitoring and, if it was on, the limit. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Prefs.init(context)
        val s = Prefs.current
        if (s.bootStart && (s.keepLogging || s.limitEnabled)) SaratService.apply(context)
    }
}
