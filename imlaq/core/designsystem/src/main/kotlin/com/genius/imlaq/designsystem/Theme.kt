package com.genius.imlaq.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp

/**
 * The palette: charcoal with a stone texture, warm cream for the one thing to press, glass
 * panels drawn as a faint fill plus a hairline border, and text in three steps of contrast.
 * Every colour the UI uses comes from here — screens never hard-code one.
 */
@Immutable
data class ImlaqColors(
    val isDark: Boolean,
    val background: Color,
    val backgroundGlow: Color,
    val glass: Color,
    val glassStrong: Color,
    val hairline: Color,
    val accent: Color,
    val onAccent: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val success: Color,
    val warning: Color,
    val danger: Color,
)

val DarkColors = ImlaqColors(
    isDark = true,
    background = Color(0xFF141414),
    backgroundGlow = Color(0xFF2E2D2B),
    glass = Color.White.copy(alpha = 0.035f),
    glassStrong = Color.White.copy(alpha = 0.07f),
    hairline = Color.White.copy(alpha = 0.11f),
    accent = Color(0xFFF1EEE7),
    onAccent = Color(0xFF151515),
    textPrimary = Color(0xFFF2F0EB),
    textSecondary = Color(0xFFB9B6AF),
    textMuted = Color(0xFF77746E),
    success = Color(0xFF34C77B),
    warning = Color(0xFFE0A84A),
    danger = Color(0xFFE5675F),
)

val LightColors = ImlaqColors(
    isDark = false,
    background = Color(0xFFF1EEE7),
    backgroundGlow = Color(0xFFFFFFFF),
    glass = Color.Black.copy(alpha = 0.03f),
    glassStrong = Color.Black.copy(alpha = 0.06f),
    hairline = Color.Black.copy(alpha = 0.12f),
    accent = Color(0xFF161616),
    onAccent = Color(0xFFF1EEE7),
    textPrimary = Color(0xFF151515),
    textSecondary = Color(0xFF55524D),
    textMuted = Color(0xFF8E8A83),
    success = Color(0xFF1E9E5E),
    warning = Color(0xFFB7791F),
    danger = Color(0xFFC0443C),
)

val LocalImlaqColors = staticCompositionLocalOf { DarkColors }

val PlexArabic = FontFamily(
    Font(R.font.ibm_plex_sans_arabic_regular, FontWeight.Normal),
    Font(R.font.ibm_plex_sans_arabic_medium, FontWeight.Medium),
    Font(R.font.ibm_plex_sans_arabic_semibold, FontWeight.SemiBold),
    Font(R.font.ibm_plex_sans_arabic_bold, FontWeight.Bold),
)

private fun style(size: Int, weight: FontWeight, line: Int) =
    TextStyle(fontFamily = PlexArabic, fontWeight = weight, fontSize = size.sp, lineHeight = line.sp)

private val ImlaqTypography = Typography(
    displayLarge = style(46, FontWeight.Bold, 56),
    displayMedium = style(38, FontWeight.Bold, 48),
    headlineLarge = style(32, FontWeight.Bold, 42),
    headlineMedium = style(26, FontWeight.Bold, 36),
    titleLarge = style(21, FontWeight.SemiBold, 30),
    titleMedium = style(17, FontWeight.SemiBold, 26),
    bodyLarge = style(17, FontWeight.Normal, 30),
    bodyMedium = style(15, FontWeight.Normal, 26),
    bodySmall = style(13, FontWeight.Normal, 22),
    labelLarge = style(16, FontWeight.SemiBold, 24),
    labelMedium = style(14, FontWeight.Medium, 20),
    labelSmall = style(12, FontWeight.Medium, 18),
)

/**
 * The app theme. Arabic-first, so the layout is right-to-left whatever the system language.
 */
@Composable
fun ImlaqTheme(dark: Boolean = true, content: @Composable () -> Unit) {
    val c = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = c.accent, onPrimary = c.onAccent,
            background = c.background, onBackground = c.textPrimary,
            surface = c.background, onSurface = c.textPrimary,
            surfaceVariant = c.glassStrong, onSurfaceVariant = c.textSecondary,
            outline = c.hairline, error = c.danger,
        )
    } else {
        lightColorScheme(
            primary = c.accent, onPrimary = c.onAccent,
            background = c.background, onBackground = c.textPrimary,
            surface = c.background, onSurface = c.textPrimary,
            surfaceVariant = c.glassStrong, onSurfaceVariant = c.textSecondary,
            outline = c.hairline, error = c.danger,
        )
    }
    CompositionLocalProvider(
        LocalImlaqColors provides c,
        LocalLayoutDirection provides LayoutDirection.Rtl,
    ) {
        MaterialTheme(colorScheme = scheme, typography = ImlaqTypography, content = content)
    }
}

object Imlaq {
    val colors: ImlaqColors
        @Composable get() = LocalImlaqColors.current
}
