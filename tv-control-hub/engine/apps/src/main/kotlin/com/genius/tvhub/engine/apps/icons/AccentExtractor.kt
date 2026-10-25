package com.genius.tvhub.engine.apps.icons

import kotlin.math.max
import kotlin.math.min

/**
 * The colour an icon "is": the most common vivid hue, ignoring near-white, near-black and grey
 * pixels (backgrounds, outlines). Pure, on ARGB pixels, so it is tested without Android.
 * Returns ARGB, or [fallback] for icons with no vivid colour.
 */
object AccentExtractor {
    fun accent(pixels: IntArray, fallback: Int = 0xFF8A8A8A.toInt()): Int {
        val buckets = IntArray(36) // 10° hue buckets
        val sumR = LongArray(36); val sumG = LongArray(36); val sumB = LongArray(36)
        for (p in pixels) {
            val a = p ushr 24 and 0xFF
            if (a < 128) continue
            val r = p shr 16 and 0xFF; val g = p shr 8 and 0xFF; val b = p and 0xFF
            val mx = max(r, max(g, b)); val mn = min(r, min(g, b))
            val sat = if (mx == 0) 0f else (mx - mn) / mx.toFloat()
            if (mx < 40 || sat < 0.28f || (mx > 235 && sat < 0.35f)) continue
            val h = hue(r, g, b, mx, mn)
            val i = (h / 10).toInt().coerceIn(0, 35)
            buckets[i]++; sumR[i] += r.toLong(); sumG[i] += g.toLong(); sumB[i] += b.toLong()
        }
        val best = buckets.indices.maxByOrNull { buckets[it] } ?: return fallback
        val n = buckets[best]
        if (n < pixels.size / 50 || n == 0) return fallback
        return (0xFF shl 24) or ((sumR[best] / n).toInt() shl 16) or ((sumG[best] / n).toInt() shl 8) or (sumB[best] / n).toInt()
    }

    private fun hue(r: Int, g: Int, b: Int, mx: Int, mn: Int): Float {
        val d = (mx - mn).toFloat()
        if (d == 0f) return 0f
        val h = when (mx) {
            r -> ((g - b) / d) % 6
            g -> (b - r) / d + 2
            else -> (r - g) / d + 4
        } * 60
        return if (h < 0) h + 360 else h
    }
}
