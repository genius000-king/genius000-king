package com.genius.saraat.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import com.genius.saraat.R

/** Palette: white canvas, one blue accent, soft blue-grey surfaces. */
object Palette {
    val Blue = Color(0xFF1E6BFF)
    val BlueSoft = Color(0xFFE8F0FF)
    val BlueLight = Color(0xFF8DB4FF)
    val Ink = Color(0xFF0B1B33)
    val Muted = Color(0xFF6B7A90)
    val Surface = Color(0xFFF5F8FD)
    val Outline = Color(0xFFE3E9F2)
    val Track = Color(0xFFE6EDF8)
    val Warn = Color(0xFFE5484D)
}

val Tajawal = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
)

private fun style(size: Int, weight: FontWeight, color: Color = Palette.Ink, line: Int = size + 8) = TextStyle(
    fontFamily = Tajawal, fontSize = size.sp, fontWeight = weight, color = color, lineHeight = line.sp,
)

private val AppTypography = Typography(
    displayLarge = style(48, FontWeight.Bold),
    headlineMedium = style(24, FontWeight.Bold),
    titleLarge = style(20, FontWeight.Bold),
    titleMedium = style(16, FontWeight.Bold),
    bodyLarge = style(16, FontWeight.Normal),
    bodyMedium = style(14, FontWeight.Normal),
    bodySmall = style(12, FontWeight.Normal, Palette.Muted),
    labelLarge = style(14, FontWeight.Medium),
    labelMedium = style(12, FontWeight.Medium),
)

private val AppColors = lightColorScheme(
    primary = Palette.Blue,
    onPrimary = Color.White,
    primaryContainer = Palette.BlueSoft,
    onPrimaryContainer = Palette.Blue,
    background = Color.White,
    onBackground = Palette.Ink,
    surface = Color.White,
    onSurface = Palette.Ink,
    surfaceVariant = Palette.Surface,
    onSurfaceVariant = Palette.Muted,
    outline = Palette.Outline,
    outlineVariant = Palette.Outline,
    surfaceContainer = Palette.Surface,
    surfaceContainerLowest = Color.White,
    surfaceTint = Color.Transparent,
)

/** The app is Arabic-only, so the whole tree is forced to right-to-left. */
@Composable
fun SaratTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(colorScheme = AppColors, typography = AppTypography, content = content)
    }
}

@Composable
fun Muted(text: String, modifier: Modifier = Modifier, align: TextAlign = TextAlign.Start) {
    Text(text, modifier, style = MaterialTheme.typography.bodySmall, textAlign = align)
}
