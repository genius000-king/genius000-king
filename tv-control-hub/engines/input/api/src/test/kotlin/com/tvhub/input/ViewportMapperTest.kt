package com.tvhub.input

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ViewportMapperTest {

    private val tolerance = 1e-4f
    private val hdVideo = Dimensions(1920f, 1080f)

    @Test
    fun `touch at the centre of a matching view maps to the centre of the video`() {
        val point = ViewportMapper.toVideoPoint(800f, 450f, Dimensions(1600f, 900f), hdVideo)

        assertEquals(0.5f, point?.x ?: error("expected a point"), tolerance)
        assertEquals(0.5f, point.y, tolerance)
    }

    @Test
    fun `corners of a matching view map to the corners of the video`() {
        val view = Dimensions(1600f, 900f)
        val topLeft = ViewportMapper.toVideoPoint(0f, 0f, view, hdVideo)
        val bottomRight = ViewportMapper.toVideoPoint(1600f, 900f, view, hdVideo)

        assertEquals(0f, topLeft?.x ?: error("expected a point"), tolerance)
        assertEquals(0f, topLeft.y, tolerance)
        assertEquals(1f, bottomRight?.x ?: error("expected a point"), tolerance)
        assertEquals(1f, bottomRight.y, tolerance)
    }

    @Test
    fun `touch in the pillarbox side bars is ignored`() {
        // 4:3 video in a 16:9 view: shown at 1200x900, starting 200px from the left.
        val view = Dimensions(1600f, 900f)
        val video = Dimensions(1000f, 750f)

        assertNull(ViewportMapper.toVideoPoint(100f, 450f, view, video))
        val centre = ViewportMapper.toVideoPoint(800f, 450f, view, video)
        assertEquals(0.5f, centre?.x ?: error("expected a point"), tolerance)
    }

    @Test
    fun `touch in the letterbox top bar is ignored, and the video area maps correctly`() {
        // 16:9 video in a 16:10 view: shown at 1600x900, starting 50px from the top.
        val view = Dimensions(1600f, 1000f)

        assertNull(ViewportMapper.toVideoPoint(800f, 20f, view, hdVideo))
        val inVideo = ViewportMapper.toVideoPoint(800f, 500f, view, hdVideo)
        assertEquals(0.5f, inVideo?.y ?: error("expected a point"), tolerance)
    }

    @Test
    fun `invalid sizes never produce a point`() {
        assertNull(ViewportMapper.toVideoPoint(10f, 10f, Dimensions(0f, 900f), hdVideo))
        assertNull(ViewportMapper.toVideoPoint(10f, 10f, Dimensions(1600f, 900f), Dimensions(0f, 1080f)))
    }
}
