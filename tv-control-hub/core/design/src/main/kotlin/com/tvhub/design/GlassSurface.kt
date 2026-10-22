package com.tvhub.design

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/**
 * Translucent brand surface.
 * Backdrop blur is not applied yet. It needs a captured backdrop, and its cost on the TV box
 * must be measured first (see docs/ROADMAP.md, phase P1).
 */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    level: GlassLevel = GlassLevel.Weak,
    shape: Shape = MaterialTheme.shapes.medium,
    content: @Composable BoxScope.() -> Unit,
) {
    val palette = LocalBrandPalette.current
    val fill = if (level == GlassLevel.Strong) palette.glassStrong else palette.glassWeak
    Box(
        modifier = modifier
            .clip(shape)
            .background(fill)
            .border(width = 1.dp, color = palette.border, shape = shape),
        content = content,
    )
}
