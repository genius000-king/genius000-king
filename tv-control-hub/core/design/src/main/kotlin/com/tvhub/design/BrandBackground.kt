package com.tvhub.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Base color plus soft halos. Grain and the bottom vignette are not included yet:
 * the grain needs a generated texture, and that is a phase P1 task.
 */
@Composable
fun BrandBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val palette = LocalBrandPalette.current
    Box(
        modifier = modifier.drawBehind {
            drawRect(palette.background)
            val longestSide = maxOf(size.width, size.height)
            BrandHalos.forEach { halo ->
                val center = Offset(halo.centerX * size.width, halo.centerY * size.height)
                val radius = halo.radius * longestSide
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(palette.halo, Color.Transparent),
                        center = center,
                        radius = radius,
                    ),
                    radius = radius,
                    center = center,
                )
            }
        },
        content = content,
    )
}
