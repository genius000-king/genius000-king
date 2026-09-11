package io.nawah.linux.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Verdict colours (GOOD / TIGHT / BLOCKED and the machine-state chips) are not
 * part of Material's scheme, so they travel in their own small holder rather
 * than being hard-coded at each call site.
 */
@Immutable
data class NawahStatusColors(
    val good: Color,
    val onGood: Color,
    val goodContainer: Color,
    val warn: Color,
    val onWarn: Color,
    val warnContainer: Color,
    val bad: Color,
    val onBad: Color,
    val badContainer: Color,
)

private val LightStatusColors = NawahStatusColors(
    good = GoodLight,
    onGood = Venice16,
    goodContainer = GoodContainerLight,
    warn = AmberLight,
    onWarn = Color(0xFF422B00),
    warnContainer = AmberContainerLight,
    bad = ClayLight,
    onBad = Color(0xFF4A130E),
    badContainer = ClayContainerLight,
)

private val DarkStatusColors = NawahStatusColors(
    good = GoodDark,
    onGood = Merino,
    goodContainer = GoodContainerDark,
    warn = AmberDark,
    onWarn = Merino,
    warnContainer = AmberContainerDark,
    bad = ClayDark,
    onBad = Merino,
    badContainer = ClayContainerDark,
)

private val LocalNawahStatusColors =
    staticCompositionLocalOf { LightStatusColors }

/** Accessors for the parts of the theme Material 3 does not model. */
object NawahTheme {
    val status: NawahStatusColors
        @Composable @ReadOnlyComposable get() = LocalNawahStatusColors.current
}

/**
 * Light: Merino paper, Venice Blue ink, Rock Blue accents.
 */
private val NawahLightColors = lightColorScheme(
    primary = VeniceBlue,
    onPrimary = Merino,
    primaryContainer = RockBlue86,
    onPrimaryContainer = Venice16,
    inversePrimary = RockBlue,

    secondary = RockBlue40,
    onSecondary = Merino98,
    secondaryContainer = RockBlue92,
    onSecondaryContainer = Venice22,

    tertiary = Color(0xFF7A6A46),
    onTertiary = Merino98,
    tertiaryContainer = Merino88,
    onTertiaryContainer = Color(0xFF2E2715),

    background = Merino,
    onBackground = Ink10,
    surface = Merino96,
    onSurface = Ink10,
    surfaceVariant = Merino88,
    onSurfaceVariant = Ink30,
    surfaceTint = VeniceBlue,

    inverseSurface = Ink20,
    inverseOnSurface = Merino,

    error = ClayLight,
    onError = Color(0xFFFFF6F4),
    errorContainer = ClayContainerLight,
    onErrorContainer = Color(0xFF4A130E),

    outline = Ink60,
    outlineVariant = Ink85,
    scrim = Color(0xFF000000),
)

/**
 * Dark: Venice Blue deepened into the background, Rock Blue carrying the
 * primary role, Merino as the text on top of it.
 */
private val NawahDarkColors = darkColorScheme(
    primary = RockBlue,
    onPrimary = Venice05,
    primaryContainer = Venice28,
    onPrimaryContainer = RockBlue92,
    inversePrimary = VeniceBlue,

    secondary = RockBlue76,
    onSecondary = Venice08,
    secondaryContainer = Venice22,
    onSecondaryContainer = RockBlue92,

    tertiary = Merino80,
    onTertiary = Color(0xFF332D1B),
    tertiaryContainer = Color(0xFF4B422D),
    onTertiaryContainer = Merino88,

    background = Venice08,
    onBackground = Merino,
    surface = Venice12,
    onSurface = Merino,
    surfaceVariant = Color(0xFF16425A),
    onSurfaceVariant = RockBlue92,
    surfaceTint = RockBlue,

    inverseSurface = Merino,
    inverseOnSurface = Venice16,

    error = ClayDark,
    onError = Color(0xFF54180F),
    errorContainer = ClayContainerDark,
    onErrorContainer = Color(0xFFFFDAD5),

    outline = Color(0xFF5D8398),
    outlineVariant = Color(0xFF27506A),
    scrim = Color(0xFF000000),
)

/**
 * No dynamic colour. The palette is the product's identity and is not the
 * wallpaper's to decide.
 *
 * The app commits to one look: Merino ground, Venice Blue ink.
 *
 * Following the system into dark mode inverted the brand — cream text on a
 * navy field — which is the opposite of the palette this product was designed
 * around. A dark scheme is still defined and still correct, so passing
 * `darkTheme = true` works; nothing reaches for it automatically.
 */
@Composable
fun NawahTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) NawahDarkColors else NawahLightColors
    val statusColors = if (darkTheme) DarkStatusColors else LightStatusColors
    CompositionLocalProvider(LocalNawahStatusColors provides statusColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NawahTypography,
            shapes = NawahShapes,
            content = content,
        )
    }
}
