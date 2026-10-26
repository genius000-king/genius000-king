package com.genius.tvhub.engine.input.keys

import android.view.View
import kotlin.math.abs

/** A rectangle in screen pixels; pure, so navigation is tested without Android. */
data class Box(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val cx get() = (left + right) / 2
    val cy get() = (top + bottom) / 2
}

/**
 * Picks the element a D-pad press should land on, when the app itself does not answer a focus
 * search: candidates in the pressed direction, preferring ones in the same row/column (beam),
 * then the nearest. Same idea as Android's FocusFinder, simplified.
 */
object SpatialNavigator {
    fun next(from: Box, candidates: List<Box>, direction: Int): Int? {
        var best = -1
        var bestScore = Long.MAX_VALUE
        candidates.forEachIndexed { i, c ->
            if (c == from) return@forEachIndexed
            val inDirection = when (direction) {
                View.FOCUS_UP -> c.cy < from.cy && c.bottom <= from.cy + (from.bottom - from.top) / 2
                View.FOCUS_DOWN -> c.cy > from.cy && c.top >= from.cy - (from.bottom - from.top) / 2
                View.FOCUS_LEFT -> c.cx < from.cx && c.right <= from.cx + (from.right - from.left) / 2
                View.FOCUS_RIGHT -> c.cx > from.cx && c.left >= from.cx - (from.right - from.left) / 2
                else -> false
            }
            if (!inDirection) return@forEachIndexed
            val vertical = direction == View.FOCUS_UP || direction == View.FOCUS_DOWN
            val major = if (vertical) abs(c.cy - from.cy) else abs(c.cx - from.cx)
            val minor = if (vertical) abs(c.cx - from.cx) else abs(c.cy - from.cy)
            val inBeam = if (vertical) c.right > from.left && c.left < from.right else c.bottom > from.top && c.top < from.bottom
            // Elements in the same row/column win; then distance along the press, then across it.
            val score = (if (inBeam) 0L else 1_000_000_000L) + major.toLong() * 13 + minor.toLong() * minor.toLong() / 8
            if (score < bestScore) { bestScore = score; best = i }
        }
        return best.takeIf { it >= 0 }
    }
}
