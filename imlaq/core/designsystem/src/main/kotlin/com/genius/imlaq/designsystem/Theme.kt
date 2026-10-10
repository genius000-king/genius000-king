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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Every colour the UI uses. Values are the ones chosen in the design lab: charcoal and warm
 * cream, glass panels as a translucent fill over a blurred backdrop plus a 10% hairline, and
 * text in three steps of contrast. Screens never hard-code a colour.
 */
@Immutable
data class ImlaqColors(
    val isDark: Boolean,
    val background: Color,
    /** Primary text and icons. */
    val text: Color,
    /** Secondary text (62%). */
    val muted: Color,
    /** Labels, placeholders, meta (38%). */
    val faint: Color,
    /** Hairline borders and tracks (10%). */
    val line: Color,
    /** Glass fill, drawn over the blurred backdrop. */
    val glass: Color,
    /** Stronger glass, for floating bars and the fallback when blur is unavailable. */
    val glassHi: Color,
    /** The solid button colour, and the user's own message bubble. */
    val accent: Color,
    val onAccent: Color,
    val ok: Color,
    val warn: Color,
    val bad: Color,
    /** Highlight used by the stone texture's clouds. */
    val cloud: Color,
)

private val Cream = Color(0xFFF1F0EC)
private val Charcoal = Color(0xFF0A0A0A)
private val Ink = Color(0xFF111110)

val DarkColors = ImlaqColors(
    isDark = true,
    background = Charcoal,
    text = Cream,
    muted = Cream.copy(alpha = 0.62f),
    faint = Cream.copy(alpha = 0.38f),
    line = Cream.copy(alpha = 0.10f),
    glass = Color(18, 18, 18).copy(alpha = 0.58f),
    glassHi = Color(28, 28, 28).copy(alpha = 0.72f),
    accent = Cream,
    onAccent = Charcoal,
    ok = Color(0xFF3DDC84),
    warn = Color(0xFFE8B14F),
    bad = Color(0xFFEF6B62),
    cloud = Color.White.copy(alpha = 0.07f),
)

val LightColors = ImlaqColors(
    isDark = false,
    background = Color(0xFFE9E8E4),
    text = Ink,
    muted = Ink.copy(alpha = 0.64f),
    faint = Ink.copy(alpha = 0.40f),
    line = Ink.copy(alpha = 0.10f),
    glass = Color.White.copy(alpha = 0.55f),
    glassHi = Color.White.copy(alpha = 0.78f),
    accent = Ink,
    onAccent = Cream,
    ok = Color(0xFF1F9D5C),
    warn = Color(0xFFB07A1C),
    bad = Color(0xFFC4453C),
    cloud = Color.White.copy(alpha = 0.70f),
)

/** Shape and blur constants from the lab: 22 dp cards, pills, 16 dp blur on cards, 18 on bars. */
object ImlaqDimens {
    val cardRadius = 22.dp
    val bubbleTail = 8.dp
    val cardBlur = 16.dp
    val barBlur = 18.dp
    val buttonHeight = 52.dp
    val smallButtonHeight = 40.dp
}

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
    headlineMedium = style(26, FontWeight.Bold, 36),
    titleLarge = style(20, FontWeight.Bold, 28),
    titleMedium = style(16, FontWeight.SemiBold, 24),
    bodyLarge = style(16, FontWeight.Normal, 28),
    bodyMedium = style(14, FontWeight.Normal, 24),
    bodySmall = style(12, FontWeight.Normal, 20),
    labelLarge = style(16, FontWeight.SemiBold, 24),
    labelMedium = style(14, FontWeight.SemiBold, 20),
    labelSmall = style(12, FontWeight.Medium, 18),
)

/** The app theme. Arabic-first, so the layout is right-to-left whatever the system language. */
@Composable
fun ImlaqTheme(dark: Boolean = true, content: @Composable () -> Unit) {
    val c = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(primary = c.accent, onPrimary = c.onAccent, background = c.background, onBackground = c.text, surface = c.background, onSurface = c.text, outline = c.line, error = c.bad)
    } else {
        lightColorScheme(primary = c.accent, onPrimary = c.onAccent, background = c.background, onBackground = c.text, surface = c.background, onSurface = c.text, outline = c.line, error = c.bad)
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
