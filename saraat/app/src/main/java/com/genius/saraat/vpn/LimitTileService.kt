package com.genius.saraat.vpn

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.genius.saraat.Controller
import com.genius.saraat.MainActivity
import com.genius.saraat.data.Prefs
import com.genius.saraat.data.formatLimit

/** Quick Settings tile: switch the speed limit on/off from the notification shade. */
class LimitTileService : TileService() {
    override fun onStartListening() = refresh()

    override fun onClick() {
        Prefs.init(this)
        val s = Prefs.current
        if (s.limitEnabled) {
            Controller.setLimitEnabled(this, false)
        } else if (!SaratService.hasVpnPermission(this) || !s.appsValid) {
            // The system VPN consent dialog needs an Activity, so hand over to the app.
            openApp()
            return
        } else {
            Controller.setLimitEnabled(this, true)
        }
        refresh()
    }

    private fun refresh() {
        val tile = qsTile ?: return
        val s = Prefs.current
        tile.state = if (s.limitEnabled) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.subtitle = if (s.limitEnabled) formatLimit(s.downKbps) else "متوقف"
        tile.updateTile()
    }

    // The PendingIntent overload only exists from API 34; older versions only have the Intent one.
    @SuppressLint("StartActivityAndCollapseDeprecated")
    @Suppress("DEPRECATION")
    private fun openApp() {
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE))
        } else {
            startActivityAndCollapse(intent)
        }
    }
}
