package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

/** Three choices, not a slider: the phone user picks intent, the encoder picks numbers. */
enum class StreamQuality(val maxHeight: Int, val bitrate: Int, val fps: Int) {
    LOW(480, 1_500_000, 30),
    BALANCED(720, 4_000_000, 30),
    HIGH(1080, 8_000_000, 60),
}

@Serializable
data class VideoFormat(val width: Int, val height: Int, val fps: Int, val bitrate: Int)
