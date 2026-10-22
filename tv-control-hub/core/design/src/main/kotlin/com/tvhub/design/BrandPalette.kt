package com.tvhub.design

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Color tokens from the visual identity reference. Dark is the reference theme.
 * Opacity is part of the token: glass is one base color at a fixed alpha.
 */
@Immutable
data class BrandPalette(
    val background: Color,
    val glassWeak: Color,
    val glassStrong: Color,
    val content: Color,
    val contentSecondary: Color,
    val contentTertiary: Color,
    val border: Color,
    val halo: Color,
    val success: Color,
    val warning: Color,
    val error: Color,
)

val DarkPalette = BrandPalette(
    background = Color(0xFF0A0A0A),
    glassWeak = Color(0xFF121212).copy(alpha = 0.58f),
    glassStrong = Color(0xFF1C1C1C).copy(alpha = 0.72f),
    content = Color(0xFFF1F0EC),
    contentSecondary = Color(0xFFF1F0EC).copy(alpha = 0.62f),
    contentTertiary = Color(0xFFF1F0EC).copy(alpha = 0.38f),
    border = Color(0xFFF1F0EC).copy(alpha = 0.10f),
    halo = Color.White.copy(alpha = 0.07f),
    success = Color(0xFF3DDC84),
    warning = Color(0xFFE8B14F),
    error = Color(0xFFEF6B62),
)

/**
 * The reference lists halo strength at 70% for the light theme,
 * so the halo alpha is 0.07 × 0.70 = 0.049.
 */
val LightPalette = BrandPalette(
    background = Color(0xFFE9E8E4),
    glassWeak = Color.White.copy(alpha = 0.55f),
    glassStrong = Color.White.copy(alpha = 0.78f),
    content = Color(0xFF111110),
    contentSecondary = Color(0xFF111110).copy(alpha = 0.64f),
    contentTertiary = Color(0xFF111110).copy(alpha = 0.40f),
    border = Color(0xFF111110).copy(alpha = 0.10f),
    halo = Color.White.copy(alpha = 0.049f),
    success = Color(0xFF1F9D5C),
    warning = Color(0xFFB07A1C),
    error = Color(0xFFC4453C),
)

val LocalBrandPalette = staticCompositionLocalOf { DarkPalette }
