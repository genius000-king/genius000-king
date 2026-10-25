package com.genius.tvhub.engine.input.gesture

import com.genius.tvhub.core.model.NormPoint
import kotlin.math.abs
import kotlin.math.max

/** A stroke in screen pixels, ready for GestureDescription. */
data class Stroke(val points: List<Pair<Float, Float>>, val durationMillis: Long)

/**
 * Turns resolution-independent input into screen strokes. Pure; the service only converts the
 * result into a GestureDescription.
 */
class GesturePlanner(private val widthPx: Int, private val heightPx: Int) {

    fun toScreen(p: NormPoint): Pair<Float, Float> {
        val c = p.clamped()
        // Keep one pixel inside the edge: gestures exactly on the edge are dropped by some builds.
        return (c.x * (widthPx - 1)).coerceIn(1f, widthPx - 2f) to (c.y * (heightPx - 1)).coerceIn(1f, heightPx - 2f)
    }

    fun tap(at: NormPoint) = Stroke(listOf(toScreen(at)), TAP_MS)

    fun longPress(at: NormPoint) = Stroke(listOf(toScreen(at)), LONG_PRESS_MS)

    fun swipe(points: List<NormPoint>, durationMillis: Long): Stroke? {
        if (points.isEmpty()) return null
        if (points.size == 1) return tap(points.first())
        return Stroke(points.map(::toScreen), durationMillis.coerceIn(MIN_SWIPE_MS, MAX_SWIPE_MS))
    }

    /**
     * Scroll the content under [from] by (dx, dy) screen pixels, the way a finger drags it:
     * content moving up means the finger moves up. Short, fast strokes feel like scroll wheels.
     */
    fun scroll(from: Pair<Float, Float>, dx: Float, dy: Float): Stroke? {
        if (abs(dx) < 1f && abs(dy) < 1f) return null
        val (x, y) = from
        val tx = (x - dx).coerceIn(1f, widthPx - 2f)
        val ty = (y - dy).coerceIn(1f, heightPx - 2f)
        val distance = max(abs(tx - x), abs(ty - y))
        return Stroke(listOf(x to y, tx to ty), (distance / 2.5f).toLong().coerceIn(MIN_SWIPE_MS, 400))
    }

    companion object {
        const val TAP_MS = 40L
        const val LONG_PRESS_MS = 650L
        const val MIN_SWIPE_MS = 60L
        const val MAX_SWIPE_MS = 3_000L
    }
}
