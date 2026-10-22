package com.tvhub.input.tv

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import com.tvhub.input.VideoPoint
import com.tvhub.protocol.NavAction

/** Performs input on the TV. Each call returns false when the accessibility service is not enabled. */
object TvInputController {

    val isAvailable: Boolean
        get() = InputAccessibilityService.instance != null

    /** Taps a point given as fractions (0..1) of the full TV screen. */
    fun tap(point: VideoPoint): Boolean {
        val service = InputAccessibilityService.instance ?: return false
        val metrics = service.resources.displayMetrics
        val x = point.x * metrics.widthPixels
        val y = point.y * metrics.heightPixels

        // A path with one segment is needed: a zero-length path is not dispatched as a gesture.
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x + 1f, y)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0L, TAP_DURATION_MS)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return service.dispatchGesture(gesture, null, null)
    }

    fun navigate(action: NavAction): Boolean {
        val service = InputAccessibilityService.instance ?: return false
        return service.performGlobalAction(action.toGlobalAction())
    }

    private fun NavAction.toGlobalAction(): Int = when (this) {
        NavAction.BACK -> AccessibilityService.GLOBAL_ACTION_BACK
        NavAction.HOME -> AccessibilityService.GLOBAL_ACTION_HOME
        NavAction.RECENTS -> AccessibilityService.GLOBAL_ACTION_RECENTS
        NavAction.NOTIFICATIONS -> AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS
    }

    private const val TAP_DURATION_MS = 60L
}
