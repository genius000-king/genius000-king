package com.genius.tvhub.engine.stream.quality

import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.model.VideoFormat
import kotlin.math.roundToInt

/**
 * Picks the encode size for a display and a quality: keep the aspect ratio, never upscale, and
 * align to 16 px (hardware encoders such as Amlogic's are happiest on macroblock boundaries).
 */
object StreamPlanner {
    fun plan(displayWidth: Int, displayHeight: Int, quality: StreamQuality): VideoFormat {
        val landscape = displayWidth >= displayHeight
        val short = if (landscape) displayHeight else displayWidth
        val long = if (landscape) displayWidth else displayHeight
        val targetShort = minOf(short, quality.maxHeight)
        val targetLong = (long.toFloat() * targetShort / short).roundToInt()
        val s = align(targetShort); val l = align(targetLong)
        val (w, h) = if (landscape) l to s else s to l
        // Bitrate scales with pixels relative to the profile's nominal 16:9 frame.
        val nominal = quality.maxHeight * quality.maxHeight * 16 / 9f
        val bitrate = (quality.bitrate * (w * h / nominal)).roundToInt().coerceIn(500_000, quality.bitrate)
        return VideoFormat(w, h, quality.fps, bitrate)
    }

    private fun align(v: Int) = ((v + 8) / 16 * 16).coerceAtLeast(16)
}
