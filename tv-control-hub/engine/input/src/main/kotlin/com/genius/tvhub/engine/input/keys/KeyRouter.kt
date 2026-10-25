package com.genius.tvhub.engine.input.keys

import android.accessibilityservice.AccessibilityService
import android.media.AudioManager
import android.view.KeyEvent
import com.genius.tvhub.core.model.KeyAction

/** How one button press is carried out on this Android version, without root. */
sealed interface KeyRoute {
    /** AccessibilityService.performGlobalAction. */
    data class Global(val action: Int) : KeyRoute
    /** AudioManager.adjustStreamVolume — works even without accessibility. */
    data class Volume(val direction: Int) : KeyRoute
    /** AudioManager.dispatchMediaKeyEvent — reaches the active media session. */
    data class Media(val keyCode: Int) : KeyRoute
    data class Unsupported(val why: String) : KeyRoute
}

/**
 * Pure mapping from a button to a route. The D-pad global actions arrived in Android 13 (API 33);
 * the Xiaomi TV Box S 3rd Gen runs Android 14, older boxes get a clear "unsupported".
 */
object KeyRouter {
    fun route(action: KeyAction, sdkInt: Int): KeyRoute = when (action) {
        KeyAction.UP -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_UP, sdkInt)
        KeyAction.DOWN -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_DOWN, sdkInt)
        KeyAction.LEFT -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_LEFT, sdkInt)
        KeyAction.RIGHT -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_RIGHT, sdkInt)
        KeyAction.CENTER -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_CENTER, sdkInt)
        KeyAction.BACK -> KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_BACK)
        KeyAction.HOME -> KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_HOME)
        KeyAction.RECENTS -> KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_RECENTS)
        KeyAction.NOTIFICATIONS -> KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS)
        KeyAction.QUICK_SETTINGS -> KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS)
        KeyAction.SLEEP -> KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN)
        KeyAction.VOLUME_UP -> KeyRoute.Volume(AudioManager.ADJUST_RAISE)
        KeyAction.VOLUME_DOWN -> KeyRoute.Volume(AudioManager.ADJUST_LOWER)
        KeyAction.VOLUME_MUTE -> KeyRoute.Volume(AudioManager.ADJUST_TOGGLE_MUTE)
        KeyAction.PLAY_PAUSE -> KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
        KeyAction.NEXT -> KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_NEXT)
        KeyAction.PREVIOUS -> KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_PREVIOUS)
        KeyAction.STOP -> KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_STOP)
        KeyAction.REWIND -> KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_REWIND)
        KeyAction.FAST_FORWARD -> KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD)
    }

    /** Whether the route needs the accessibility service running. */
    fun needsAccessibility(route: KeyRoute) = route is KeyRoute.Global

    private fun dpad(action: Int, sdkInt: Int): KeyRoute =
        if (sdkInt >= 33) KeyRoute.Global(action) else KeyRoute.Unsupported("D-pad needs Android 13+")
}
