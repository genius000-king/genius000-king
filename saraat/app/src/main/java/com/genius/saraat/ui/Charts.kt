package com.genius.saraat.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/** One bar of the usage chart. */
class Bar(val down: Long, val up: Long) {
    val total get() = down + up
}

/**
 * Stacked bar chart (download in blue, upload in light blue). Tap a bar to select it.
 * Time runs left to right inside the chart even though the app is right-to-left.
 */
@Composable
fun BarChart(
    bars: List<Bar>,
    selected: Int?,
    onSelect: (Int?) -> Unit,
    modifier: Modifier = Modifier,
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        val max = (bars.maxOfOrNull { it.total } ?: 0L).coerceAtLeast(1L)
        Canvas(
            modifier.pointerInput(bars.size, selected) {
                detectTapGestures { p ->
                    if (bars.isEmpty()) return@detectTapGestures
                    val i = (p.x / size.width * bars.size).toInt().coerceIn(0, bars.size - 1)
                    onSelect(if (i == selected) null else i)
                }
            },
        ) {
            val n = bars.size.coerceAtLeast(1)
            val slot = size.width / n
            val barWidth = (slot * 0.62f).coerceAtLeast(2.dp.toPx())
            val radius = CornerRadius(minOf(barWidth / 2, 4.dp.toPx()))
            val baseline = size.height - 1.dp.toPx()
            val plotH = baseline - 6.dp.toPx()

            drawLine(Palette.Outline, Offset(0f, baseline), Offset(size.width, baseline), 1.dp.toPx())
            bars.forEachIndexed { i, b ->
                val x = i * slot + (slot - barWidth) / 2
                if (i == selected) {
                    drawRoundRect(
                        Palette.BlueSoft, Offset(i * slot, 0f), Size(slot, size.height),
                        CornerRadius(6.dp.toPx()),
                    )
                }
                if (b.total <= 0) return@forEachIndexed
                val total = (b.total.toFloat() / max * plotH).coerceAtLeast(3.dp.toPx())
                val downH = total * (b.down.toFloat() / b.total)
                val upH = total - downH
                if (upH > 0.5f) {
                    drawRoundRect(Palette.BlueLight, Offset(x, baseline - total), Size(barWidth, upH + radius.x), radius)
                }
                if (downH > 0.5f) {
                    drawRoundRect(Palette.Blue, Offset(x, baseline - downH), Size(barWidth, downH), radius)
                }
            }
        }
    }
}
