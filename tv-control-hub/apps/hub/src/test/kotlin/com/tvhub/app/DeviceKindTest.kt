package com.tvhub.app

import android.content.res.Configuration
import kotlin.test.Test
import kotlin.test.assertEquals

class DeviceKindTest {

    @Test
    fun `television mode is a TV`() {
        assertEquals(DeviceKind.Tv, DeviceKind.from(Configuration.UI_MODE_TYPE_TELEVISION, hasLeanbackFeature = false))
    }

    @Test
    fun `the leanback feature marks a TV even when the mode is normal`() {
        assertEquals(DeviceKind.Tv, DeviceKind.from(Configuration.UI_MODE_TYPE_NORMAL, hasLeanbackFeature = true))
    }

    @Test
    fun `a normal device without leanback is a phone`() {
        assertEquals(DeviceKind.Phone, DeviceKind.from(Configuration.UI_MODE_TYPE_NORMAL, hasLeanbackFeature = false))
    }

    @Test
    fun `a watch without leanback is not treated as a TV`() {
        assertEquals(DeviceKind.Phone, DeviceKind.from(Configuration.UI_MODE_TYPE_WATCH, hasLeanbackFeature = false))
    }
}
