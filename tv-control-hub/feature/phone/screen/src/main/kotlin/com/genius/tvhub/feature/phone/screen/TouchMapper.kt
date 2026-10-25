package com.genius.tvhub.feature.phone.screen

import com.genius.tvhub.core.model.NormPoint

/**
 * Where a finger on the phone lands on the TV. The picture is letterboxed inside the view, so a
 * touch on the black bars maps to nothing. Pure.
 */
class TouchMapper(private val viewW: Float, private val viewH: Float, private val videoW: Int, private val videoH: Int) {
    private val scale = minOf(viewW / videoW, viewH / videoH)
    private val drawnW = videoW * scale
    private val drawnH = videoH * scale
    private val left = (viewW - drawnW) / 2
    private val top = (viewH - drawnH) / 2

    fun map(x: Float, y: Float): NormPoint? {
        val nx = (x - left) / drawnW
        val ny = (y - top) / drawnH
        return if (nx in 0f..1f && ny in 0f..1f) NormPoint(nx, ny) else null
    }
}
