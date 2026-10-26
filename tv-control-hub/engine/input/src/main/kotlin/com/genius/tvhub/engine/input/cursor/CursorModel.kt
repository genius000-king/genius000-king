package com.genius.tvhub.engine.input.cursor

import kotlin.math.abs

/**
 * Where the mouse pointer is, and how it moves. Pure. Phone touchpad deltas arrive in TV pixels;
 * D-pad presses (remote mouse) accelerate the longer a direction is held.
 */
class CursorModel(private val width: Int, private val height: Int) {
    var x = width / 2f
        private set
    var y = height / 2f
        private set

    /** Pixels the pointer could not move because it hit an edge — turned into a scroll. */
    data class Move(val overflowX: Float, val overflowY: Float)

    fun moveBy(dx: Float, dy: Float): Move {
        val nx = x + dx
        val ny = y + dy
        x = nx.coerceIn(0f, width - 1f)
        y = ny.coerceIn(0f, height - 1f)
        return Move(nx - x, ny - y)
    }

    /** Phone touchpad deltas are in 1080p pixels; scaled so a swipe feels the same on any TV. */
    val touchpadScale get() = width / 1920f

    /** The pointer as a fraction of the screen, for injectors that know their own resolution. */
    val normalized get() = x / width to y / height

    fun center() { x = width / 2f; y = height / 2f }

    /** Step for the [repeat]-th consecutive D-pad press in one direction (0 = first press). */
    fun dpadStep(repeat: Int): Float = when {
        repeat < 2 -> 14f
        repeat < 6 -> 28f
        repeat < 12 -> 48f
        else -> 72f
    } * (width / 1920f)

    companion object {
        /** Touchpad: small motions precise, fast flicks a little further — gently (at most ×1.6). */
        fun accelerate(delta: Float): Float = delta * (1f + (abs(delta) / 40f).coerceAtMost(0.6f))
    }
}
