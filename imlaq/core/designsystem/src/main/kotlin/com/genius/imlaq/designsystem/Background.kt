package com.genius.imlaq.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.rememberHazeState
import kotlin.math.floor
import kotlin.random.Random

/** The backdrop every glass panel blurs. Null outside [ImlaqBackground] (glass then draws flat). */
val LocalBackdrop = staticCompositionLocalOf<HazeState?> { null }

/**
 * The stone backdrop: charcoal base, soft lighter clouds, a low-frequency fractal "stone" layer
 * and fine grain, then a veil that fades the bottom into the base colour. All generated in code.
 *
 * The backdrop is the blur source; [content] is drawn above it as a sibling, so glass panels in
 * the content blur the stone behind them.
 */
@Composable
fun ImlaqBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val c = Imlaq.colors
    val stone = remember { stoneTexture() }
    val grain = remember { grainTile() }
    val haze = rememberHazeState()
    Box(modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize().hazeSource(haze)) {
            drawRect(c.background)
            for ((x, y, r) in CLOUDS) {
                val center = Offset(size.width * x, size.height * y)
                val radius = size.maxDimension * r
                drawCircle(Brush.radialGradient(listOf(c.cloud, Color.Transparent), center, radius), radius, center)
            }
            drawImage(
                stone,
                dstSize = IntSize(size.width.toInt(), size.height.toInt()),
                dstOffset = IntOffset.Zero,
                alpha = if (c.isDark) 0.55f else 0.35f,
                blendMode = BlendMode.Overlay,
                filterQuality = FilterQuality.High,
            )
            drawRect(
                brush = ShaderBrush(ImageShader(grain, TileMode.Repeated, TileMode.Repeated)),
                alpha = if (c.isDark) 0.16f else 0.10f,
                blendMode = BlendMode.Overlay,
            )
            drawRect(
                Brush.radialGradient(
                    0.3f to Color.Transparent,
                    1f to c.background,
                    center = Offset(size.width / 2, 0f),
                    radius = size.height * 0.9f,
                ),
                alpha = 0.55f,
            )
        }
        CompositionLocalProvider(LocalBackdrop provides haze) { content() }
    }
}

private val CLOUDS = listOf(
    Triple(0.15f, 0.12f, 0.45f),
    Triple(0.85f, 0.38f, 0.40f),
    Triple(0.30f, 0.75f, 0.45f),
    Triple(0.80f, 0.92f, 0.35f),
)

/**
 * Fractal value noise, 5 octaves, as white with the noise in alpha — thresholded so only the
 * brighter "veins" show. Small on purpose: it is scaled up with bilinear filtering, which is
 * exactly the softness stone needs.
 */
private fun stoneTexture(w: Int = 120, h: Int = 260): ImageBitmap {
    val rnd = Random(11)
    val lattice = Array(5) { FloatArray(64 * 64) { rnd.nextFloat() } }
    fun smooth(t: Float) = t * t * (3 - 2 * t)
    fun value(o: Int, x: Float, y: Float): Float {
        val xi = floor(x).toInt(); val yi = floor(y).toInt()
        val tx = smooth(x - xi); val ty = smooth(y - yi)
        fun at(i: Int, j: Int) = lattice[o][(j and 63) * 64 + (i and 63)]
        val a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * tx
        val b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * tx
        return a + (b - a) * ty
    }
    val pixels = IntArray(w * h)
    for (y in 0 until h) for (x in 0 until w) {
        var n = 0f; var amp = 0.5f; var freq = 1f / 40f
        for (o in 0 until 5) {
            n += value(o, x * freq, y * freq * 0.6f) * amp
            amp *= 0.5f; freq *= 2f
        }
        val a = ((n * 1.4f - 0.45f).coerceIn(0f, 1f) * 255).toInt()
        pixels[y * w + x] = (a shl 24) or 0xFFFFFF
    }
    return android.graphics.Bitmap.createBitmap(pixels, w, h, android.graphics.Bitmap.Config.ARGB_8888).asImageBitmap()
}

/** 160×160 grey noise for film grain. */
private fun grainTile(): ImageBitmap {
    val n = 160
    val rnd = Random(7)
    val pixels = IntArray(n * n) {
        val v = rnd.nextInt(0, 256)
        (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    }
    return android.graphics.Bitmap.createBitmap(pixels, n, n, android.graphics.Bitmap.Config.ARGB_8888).asImageBitmap()
}
