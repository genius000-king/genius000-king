package com.genius.imlaq.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.asImageBitmap
import kotlin.random.Random

/**
 * The stone backdrop: a flat charcoal base, a few soft lighter clouds, and a fine film grain
 * tiled over everything. Generated in code — no image asset, nothing to scale badly.
 */
@Composable
fun ImlaqBackground(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val c = Imlaq.colors
    val grain = remember { grainTile() }
    Box(modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(c.background)
            // Soft "smoke" patches, like the veins in the stone texture.
            val clouds = listOf(
                Triple(0.10f, 0.06f, 0.42f),
                Triple(0.90f, 0.20f, 0.38f),
                Triple(0.35f, 0.38f, 0.30f),
                Triple(0.80f, 0.55f, 0.44f),
                Triple(0.15f, 0.72f, 0.40f),
                Triple(0.65f, 0.92f, 0.36f),
            )
            for ((x, y, r) in clouds) {
                val center = Offset(size.width * x, size.height * y)
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(c.backgroundGlow.copy(alpha = if (c.isDark) 0.75f else 0.8f), Color.Transparent),
                        center = center,
                        radius = size.maxDimension * r,
                    ),
                    radius = size.maxDimension * r,
                    center = center,
                )
            }
            drawRect(
                brush = ShaderBrush(ImageShader(grain, TileMode.Repeated, TileMode.Repeated)),
                alpha = if (c.isDark) 0.13f else 0.07f,
            )
            // Darken the edges a touch so the content in the middle reads first.
            drawRect(
                Brush.radialGradient(
                    colors = listOf(Color.Transparent, c.background.copy(alpha = 0.55f)),
                    center = Offset(size.width / 2, size.height / 2),
                    radius = size.maxDimension * 0.75f,
                ),
            )
        }
        content()
    }
}

/** 192×192 monochrome noise; alpha carries the grain so one tile serves both themes. */
private fun grainTile(): ImageBitmap {
    val n = 192
    val rnd = Random(7)
    val pixels = IntArray(n * n) {
        val a = rnd.nextInt(0, 256)
        val v = if (rnd.nextBoolean()) 0xFF else 0x00
        (a shl 24) or (v shl 16) or (v shl 8) or v
    }
    return android.graphics.Bitmap.createBitmap(pixels, n, n, android.graphics.Bitmap.Config.ARGB_8888)
        .asImageBitmap()
}
