package com.tvhub.design

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Pins the tokens to the identity reference, so a refactor cannot drift the brand unnoticed.
 * Alpha is stored at 8-bit precision, hence the tolerance.
 */
class BrandPaletteTest {

    private val alphaTolerance = 0.005f

    @Test
    fun `dark palette matches the reference`() {
        assertEquals(Color(0xFF0A0A0A), DarkPalette.background)
        assertEquals(Color(0xFFF1F0EC), DarkPalette.content)
        assertEquals(0.58f, DarkPalette.glassWeak.alpha, alphaTolerance)
        assertEquals(0.72f, DarkPalette.glassStrong.alpha, alphaTolerance)
        assertEquals(0.62f, DarkPalette.contentSecondary.alpha, alphaTolerance)
        assertEquals(0.38f, DarkPalette.contentTertiary.alpha, alphaTolerance)
        assertEquals(0.10f, DarkPalette.border.alpha, alphaTolerance)
    }

    @Test
    fun `light palette matches the reference`() {
        assertEquals(Color(0xFFE9E8E4), LightPalette.background)
        assertEquals(Color(0xFF111110), LightPalette.content)
        assertEquals(0.55f, LightPalette.glassWeak.alpha, alphaTolerance)
        assertEquals(0.78f, LightPalette.glassStrong.alpha, alphaTolerance)
        assertEquals(0.64f, LightPalette.contentSecondary.alpha, alphaTolerance)
        assertEquals(0.40f, LightPalette.contentTertiary.alpha, alphaTolerance)
    }

    @Test
    fun `semantic colors match the reference in both themes`() {
        assertEquals(Color(0xFF3DDC84), DarkPalette.success)
        assertEquals(Color(0xFFE8B14F), DarkPalette.warning)
        assertEquals(Color(0xFFEF6B62), DarkPalette.error)
        assertEquals(Color(0xFF1F9D5C), LightPalette.success)
        assertEquals(Color(0xFFB07A1C), LightPalette.warning)
        assertEquals(Color(0xFFC4453C), LightPalette.error)
    }

    @Test
    fun `background uses the four halos from the reference`() {
        assertEquals(4, BrandHalos.size)
        assertEquals(Halo(0.15f, 0.12f, 0.45f), BrandHalos.first())
    }
}
