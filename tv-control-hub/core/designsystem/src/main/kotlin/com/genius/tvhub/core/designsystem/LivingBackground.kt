package com.genius.tvhub.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateOffsetAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.rememberHazeState
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * The stone backdrop, alive: the four clouds drift on slow orbits (a minute per loop, a few
 * percent of the screen — you notice it only when you look), and an ambient light takes the
 * colour of whatever is focused, glowing around it and washing faintly over the whole stone.
 *
 * @param glow the focused thing's colour, or null for none.
 * @param glowAt where it is, as a fraction of the screen (0..1).
 * @param intensity 0..1, from the appearance settings.
 * @param motion false when the user turned motion off (or the device asks for reduced motion).
 */
@Composable
fun LivingBackground(
    modifier: Modifier = Modifier,
    glow: Color? = null,
    glowAt: Offset = Offset(0.5f, 0.75f),
    intensity: Float = 0.7f,
    motion: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    val c = Imlaq.colors
    val stone = remember { stoneTexture() }
    val grain = remember { grainTile() }
    val haze = rememberHazeState()
    val blur = LocalEffects.current == Effects.FULL

    val t = rememberInfiniteTransition(label = "drift")
    val phase by t.animateFloat(0f, (2 * PI).toFloat(), infiniteRepeatable(tween(64_000, easing = LinearEasing)), label = "phase")
    val p = if (motion) phase else 0f

    val glowColor by animateColorAsState(glow ?: Color.Transparent, tween(700), label = "glow")
    val glowPos by animateOffsetAsState(glowAt, spring(stiffness = Spring.StiffnessLow), label = "glow-pos")
    val strength = intensity.coerceIn(0f, 1f) * if (c.isDark) 1f else 0.6f

    Box(modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize().then(if (blur) Modifier.hazeSource(haze) else Modifier)) {
            drawRect(c.background)

            // Ambient wash: the focused colour tints the whole stone, very faintly.
            drawRect(glowColor.copy(alpha = glowColor.alpha * 0.04f * strength))

            DRIFT.forEachIndexed { i, d ->
                val a = p * d.speed + i * 1.7f
                val center = Offset(size.width * (d.x + d.amp * cos(a)), size.height * (d.y + d.amp * sin(a * 0.8f)))
                val radius = size.maxDimension * d.r
                drawCircle(Brush.radialGradient(listOf(c.cloud, Color.Transparent), center, radius), radius, center)
            }

            // The light behind the focused item: a large soft bloom and a tighter core.
            if (glowColor.alpha > 0.01f) {
                val at = Offset(size.width * glowPos.x, size.height * glowPos.y)
                val bloom = size.maxDimension * 0.42f
                drawCircle(Brush.radialGradient(listOf(glowColor.copy(alpha = 0.16f * strength * glowColor.alpha), Color.Transparent), at, bloom), bloom, at)
                val core = size.maxDimension * 0.14f
                drawCircle(Brush.radialGradient(listOf(glowColor.copy(alpha = 0.12f * strength * glowColor.alpha), Color.Transparent), at, core), core, at)
            }

            drawImage(
                stone, dstSize = IntSize(size.width.toInt(), size.height.toInt()), dstOffset = IntOffset.Zero,
                alpha = if (c.isDark) 0.55f else 0.35f, blendMode = BlendMode.Overlay, filterQuality = FilterQuality.High,
            )
            drawRect(ShaderBrush(ImageShader(grain, TileMode.Repeated, TileMode.Repeated)), alpha = if (c.isDark) 0.16f else 0.10f, blendMode = BlendMode.Overlay)
            drawRect(
                Brush.radialGradient(0.3f to Color.Transparent, 1f to c.background, center = Offset(size.width / 2, 0f), radius = size.height * 1.1f),
                alpha = 0.45f,
            )
        }
        CompositionLocalProvider(LocalBackdrop provides if (blur) haze else null) { content() }
    }
}

private class Drift(val x: Float, val y: Float, val r: Float, val amp: Float, val speed: Float)

/** The original four clouds (Background.kt), each on its own slow orbit. */
private val DRIFT = listOf(
    Drift(0.15f, 0.12f, 0.45f, 0.035f, 1f),
    Drift(0.85f, 0.38f, 0.40f, 0.030f, -1f),
    Drift(0.30f, 0.75f, 0.45f, 0.040f, 2f),
    Drift(0.80f, 0.92f, 0.35f, 0.030f, -2f),
)
