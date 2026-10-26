package com.genius.tvhub.engine.input.keys

import android.accessibilityservice.AccessibilityService
import android.media.AudioManager
import android.view.KeyEvent
import android.view.View
import com.genius.tvhub.core.model.KeyAction

/** How one button press is carried out on this device, without root. */
sealed interface KeyRoute {
    /** A real key event through ADB mode: exactly what the remote would send. */
    data class Raw(val keyCode: Int) : KeyRoute
    /** AccessibilityService.performGlobalAction. */
    data class Global(val action: Int) : KeyRoute
    /** Android 12 and older without ADB mode: move the focus through accessibility. */
    data class Focus(val direction: Int) : KeyRoute
    /** Android 12 and older without ADB mode: click the focused element. */
    data object FocusClick : KeyRoute
    /** AudioManager.adjustStreamVolume — works even without accessibility. */
    data class Volume(val direction: Int) : KeyRoute
    /** AudioManager.dispatchMediaKeyEvent — reaches the active media session. */
    data class Media(val keyCode: Int) : KeyRoute
    data class Unsupported(val why: String) : KeyRoute
}

/**
 * Pure mapping from a button to the best route available. Order of preference:
 * real key events (ADB mode) → D-pad global actions (Android 13+) → accessibility focus moves.
 */
object KeyRouter {
    fun route(action: KeyAction, sdkInt: Int, rawInput: Boolean): KeyRoute {
        if (rawInput) RAW[action]?.let { return KeyRoute.Raw(it) }
        return when (action) {
            KeyAction.UP -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_UP, View.FOCUS_UP, sdkInt)
            KeyAction.DOWN -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_DOWN, View.FOCUS_DOWN, sdkInt)
            KeyAction.LEFT -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_LEFT, View.FOCUS_LEFT, sdkInt)
            KeyAction.RIGHT -> dpad(AccessibilityService.GLOBAL_ACTION_DPAD_RIGHT, View.FOCUS_RIGHT, sdkInt)
            KeyAction.CENTER -> if (sdkInt >= 33) KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_DPAD_CENTER) else KeyRoute.FocusClick
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
    }

    /** The key code a button stands for, when it has one (D-pad, back, media...). */
    fun keyCodeOf(action: KeyAction): Int? = RAW[action]

    /** Whether the route needs the accessibility service running. */
    fun needsAccessibility(route: KeyRoute) = route is KeyRoute.Global || route is KeyRoute.Focus || route == KeyRoute.FocusClick

    private fun dpad(globalAction: Int, focusDirection: Int, sdkInt: Int): KeyRoute =
        if (sdkInt >= 33) KeyRoute.Global(globalAction) else KeyRoute.Focus(focusDirection)

    /** Keys sent as real key events in ADB mode. Volume stays on AudioManager (reliable everywhere). */
    private val RAW = mapOf(
        KeyAction.UP to KeyEvent.KEYCODE_DPAD_UP, KeyAction.DOWN to KeyEvent.KEYCODE_DPAD_DOWN,
        KeyAction.LEFT to KeyEvent.KEYCODE_DPAD_LEFT, KeyAction.RIGHT to KeyEvent.KEYCODE_DPAD_RIGHT,
        KeyAction.CENTER to KeyEvent.KEYCODE_DPAD_CENTER, KeyAction.BACK to KeyEvent.KEYCODE_BACK,
        KeyAction.HOME to KeyEvent.KEYCODE_HOME, KeyAction.RECENTS to KeyEvent.KEYCODE_APP_SWITCH,
        KeyAction.PLAY_PAUSE to KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyAction.NEXT to KeyEvent.KEYCODE_MEDIA_NEXT,
        KeyAction.PREVIOUS to KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyAction.STOP to KeyEvent.KEYCODE_MEDIA_STOP,
        KeyAction.REWIND to KeyEvent.KEYCODE_MEDIA_REWIND, KeyAction.FAST_FORWARD to KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
        KeyAction.SLEEP to KeyEvent.KEYCODE_SLEEP,
    )
}
