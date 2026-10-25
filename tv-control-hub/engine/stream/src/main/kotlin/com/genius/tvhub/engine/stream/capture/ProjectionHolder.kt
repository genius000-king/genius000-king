package com.genius.tvhub.engine.stream.capture

import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.Looper
import android.view.Surface
import com.genius.tvhub.core.common.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * The screen-capture grant, kept alive for as long as possible. Android 14 allows one
 * VirtualDisplay per MediaProjection and asks consent again for a new projection, so the display
 * is created once and later viewers only swap its surface: opening and closing the live screen
 * from the phone never asks the TV again.
 */
class ProjectionHolder(private val context: Context) {
    private val manager = context.getSystemService(MediaProjectionManager::class.java)
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private val _active = MutableStateFlow(false)
    val active: StateFlow<Boolean> = _active

    fun consentIntent(): Intent = manager.createScreenCaptureIntent()

    /** Call only after the host service is in the foreground with the mediaProjection type. */
    fun acquire(resultCode: Int, data: Intent) {
        release()
        val p = manager.getMediaProjection(resultCode, data) ?: return
        p.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() { Log.i(TAG, "projection stopped by the system"); display?.release(); display = null; projection = null; _active.value = false }
        }, Handler(Looper.getMainLooper()))
        projection = p
        _active.value = true
    }

    fun attach(surface: Surface, width: Int, height: Int, dpi: Int) {
        val p = projection ?: throw IllegalStateException("no screen-capture grant")
        val d = display
        if (d == null) {
            display = p.createVirtualDisplay("tvhub", width, height, dpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, surface, null, null)
        } else {
            d.resize(width, height, dpi)
            d.surface = surface
        }
    }

    fun detach() { display?.surface = null }

    fun release() {
        display?.release(); display = null
        projection?.stop(); projection = null
        _active.value = false
    }

    private companion object { const val TAG = "Projection" }
}
