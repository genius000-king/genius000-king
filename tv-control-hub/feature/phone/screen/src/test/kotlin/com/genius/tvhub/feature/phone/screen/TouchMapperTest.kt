package com.genius.tvhub.feature.phone.screen

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class TouchMapperTest {
    @Test fun letterboxedTouchesMapInsideThePicture() {
        // A 16:9 picture in a square view: bars top and bottom.
        val m = TouchMapper(1600f, 1600f, 1920, 1080)
        assertThat(m.map(800f, 800f)!!.x).isWithin(1e-4f).of(0.5f)
        assertThat(m.map(800f, 100f)).isNull() // on the top bar
        val corner = m.map(0f, 350f)!!
        assertThat(corner.x).isEqualTo(0f)
        assertThat(corner.y).isWithin(0.01f).of(0f)
    }

    @Test fun exactFit() {
        val m = TouchMapper(1280f, 720f, 1280, 720)
        assertThat(m.map(1280f, 720f)).isEqualTo(com.genius.tvhub.core.model.NormPoint(1f, 1f))
    }
}
