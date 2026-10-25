package com.genius.tvhub.feature.phone.remote

import kotlin.math.abs

enum class Swipe { UP, DOWN, LEFT, RIGHT }

/**
 * Turns finger movement into arrow presses. Pure, so the feel is tuned in tests, not by guessing.
 *
 * A swipe fires once the finger has travelled [triggerPx] along a dominant axis (1.4× the other).
 * Directions are physical: a right swipe moves right on the TV whatever the app language.
 */
class SwipeClassifier(private val triggerPx: Float) {

    fun classify(dx: Float, dy: Float): Swipe? {
        val ax = abs(dx); val ay = abs(dy)
        return when {
            ax >= triggerPx && ax >= ay * DOMINANCE -> if (dx > 0) Swipe.RIGHT else Swipe.LEFT
            ay >= triggerPx && ay >= ax * DOMINANCE -> if (dy > 0) Swipe.DOWN else Swipe.UP
            else -> null
        }
    }

    companion object {
        private const val DOMINANCE = 1.4f
        /** Hold after a swipe: first repeat after 350 ms, then faster down to 45 ms. */
        fun repeatDelay(repeatIndex: Int): Long = when (repeatIndex) {
            0 -> 350
            in 1..3 -> 140
            in 4..9 -> 90
            else -> 45
        }
    }
}
