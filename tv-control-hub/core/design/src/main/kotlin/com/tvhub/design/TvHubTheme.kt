package com.tvhub.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

@Composable
fun TvHubTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val palette = if (darkTheme) DarkPalette else LightPalette
    CompositionLocalProvider(LocalBrandPalette provides palette) {
        MaterialTheme(
            colorScheme = palette.toColorScheme(isDark = darkTheme),
            shapes = BrandShapes,
            content = content,
        )
    }
}

/** Maps brand tokens onto Material 3 roles. Glass is handled by GlassSurface, not by the scheme. */
internal fun BrandPalette.toColorScheme(isDark: Boolean): ColorScheme {
    val base = if (isDark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = content,
        onPrimary = background,
        background = background,
        onBackground = content,
        surface = background,
        onSurface = content,
        onSurfaceVariant = contentSecondary,
        outline = border,
        error = error,
    )
}
