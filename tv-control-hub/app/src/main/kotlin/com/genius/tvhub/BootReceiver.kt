package com.genius.tvhub

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.runtime.host.HostService
import kotlinx.coroutines.launch

/**
 * The TV turned on: start the host and open TV Hub's home. (When TV Hub is the default home,
 * Android opens it anyway; the explicit start covers boxes where Google TV keeps the home role.)
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext as TvHubApp
        if (app.role != DeviceRole.TV) return
        val pending = goAsync()
        app.scope.launch {
            try {
                if (app.startOnBoot()) {
                    runCatching { HostService.start(context) }
                    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
                        runCatching { context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                    }
                }
            } finally {
                pending.finish()
            }
        }
    }
}
