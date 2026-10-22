package com.tvhub.input

/** A point inside the video frame. Both coordinates are in 0..1. */
data class VideoPoint(val x: Float, val y: Float)

/** A width and height in the same unit. */
data class Dimensions(val width: Float, val height: Float) {
    val isPositive: Boolean
        get() = width > 0f && height > 0f
}

/**
 * Maps a touch on a view that shows the video letterboxed (fit inside, aspect ratio kept)
 * to a point on the video frame. Touches in the black bars return null, so no tap is sent for them.
 */
object ViewportMapper {

    fun toVideoPoint(touchX: Float, touchY: Float, view: Dimensions, video: Dimensions): VideoPoint? {
        if (!view.isPositive || !video.isPositive) return null

        val scale = minOf(view.width / video.width, view.height / video.height)
        val shownWidth = video.width * scale
        val shownHeight = video.height * scale
        val left = (view.width - shownWidth) / 2f
        val top = (view.height - shownHeight) / 2f

        val x = (touchX - left) / shownWidth
        val y = (touchY - top) / shownHeight
        return if (x in 0f..1f && y in 0f..1f) VideoPoint(x, y) else null
    }
}
