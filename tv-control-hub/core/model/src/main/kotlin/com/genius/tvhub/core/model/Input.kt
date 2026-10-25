package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

/** Every button the phone can press on the TV. How each is carried out is the input engine's job. */
enum class KeyAction {
    UP, DOWN, LEFT, RIGHT, CENTER,
    BACK, HOME, RECENTS, NOTIFICATIONS, QUICK_SETTINGS,
    VOLUME_UP, VOLUME_DOWN, VOLUME_MUTE,
    PLAY_PAUSE, NEXT, PREVIOUS, STOP, REWIND, FAST_FORWARD,
    SLEEP,
}

/** A point in the TV picture, 0..1 on each axis, independent of resolution. */
@Serializable
data class NormPoint(val x: Float, val y: Float) {
    fun clamped() = NormPoint(x.coerceIn(0f, 1f), y.coerceIn(0f, 1f))
}

@Serializable
enum class TextMode { REPLACE, APPEND }

/** A named macro: a few keys, or opening an app. Lives on the phone. */
@Serializable
data class Shortcut(
    val id: Long = 0,
    val label: String,
    val steps: List<ShortcutStep>,
)

@Serializable
sealed interface ShortcutStep {
    @Serializable data class Press(val key: KeyAction) : ShortcutStep
    @Serializable data class Launch(val packageName: String) : ShortcutStep
    @Serializable data class Type(val text: String) : ShortcutStep
    @Serializable data class Wait(val millis: Long) : ShortcutStep
}
