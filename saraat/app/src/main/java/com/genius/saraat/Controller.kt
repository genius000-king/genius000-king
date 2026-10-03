package com.genius.saraat

import android.content.Context
import com.genius.saraat.data.AppMode
import com.genius.saraat.data.Prefs
import com.genius.saraat.vpn.SaratService

/** Everything the UI, the quick tile and the notification can ask the app to do. */
object Controller {
    fun setLimitEnabled(context: Context, enabled: Boolean) {
        Prefs.update {
            copy(
                limitEnabled = enabled,
                timerEndsAt = if (enabled && timerMinutes > 0) System.currentTimeMillis() + timerMinutes * 60_000L else 0L,
            )
        }
        SaratService.apply(context)
    }

    fun setDownKbps(context: Context, kbps: Int) {
        Prefs.update { copy(downKbps = kbps) }
        applyIfRunning(context)
    }

    fun setUpKbps(context: Context, kbps: Int) {
        Prefs.update { copy(upKbps = kbps) }
        applyIfRunning(context)
    }

    fun setSeparateUpload(context: Context, separate: Boolean) {
        Prefs.update { copy(separateUpload = separate) }
        applyIfRunning(context)
    }

    /** Chooses the auto-off timer; when a limit is already running the countdown restarts from now. */
    fun setTimer(context: Context, minutes: Int) {
        Prefs.update {
            copy(
                timerMinutes = minutes,
                timerEndsAt = if (limitEnabled && minutes > 0) System.currentTimeMillis() + minutes * 60_000L else 0L,
            )
        }
        applyIfRunning(context)
    }

    fun setAppSelection(context: Context, mode: AppMode, apps: Set<String>) {
        Prefs.update { copy(appMode = mode, apps = apps) }
        applyIfRunning(context)
    }

    fun setBlockQuic(context: Context, block: Boolean) {
        Prefs.update { copy(blockQuic = block) }
        applyIfRunning(context)
    }

    fun setKeepLogging(context: Context, keep: Boolean) {
        Prefs.update { copy(keepLogging = keep) }
        SaratService.apply(context)
    }

    private fun applyIfRunning(context: Context) {
        if (Prefs.current.limitEnabled) SaratService.apply(context)
    }
}
