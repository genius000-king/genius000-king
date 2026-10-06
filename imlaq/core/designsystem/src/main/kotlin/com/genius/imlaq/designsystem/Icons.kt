package com.genius.imlaq.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Line icons on a 24-unit grid with a 1.7 stroke and round caps. Drawn in black and tinted by
 * the Icon that shows them, so one vector serves both themes.
 */
object ImlaqIcons {

    private fun line(name: String, filled: Boolean = false, mirror: Boolean = false, build: PathBuilder.() -> Unit) =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f, autoMirror = mirror).path(
            fill = if (filled) SolidColor(Color.Black) else null,
            stroke = if (filled) null else SolidColor(Color.Black),
            strokeLineWidth = 1.7f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            pathBuilder = build,
        ).build()

    val Sun = line("sun") {
        // centre circle
        moveTo(16f, 12f); arcTo(4f, 4f, 0f, true, true, 8f, 12f); arcTo(4f, 4f, 0f, true, true, 16f, 12f)
        moveTo(12f, 2f); lineTo(12f, 4f); moveTo(12f, 20f); lineTo(12f, 22f)
        moveTo(2f, 12f); lineTo(4f, 12f); moveTo(20f, 12f); lineTo(22f, 12f)
        moveTo(4.9f, 4.9f); lineTo(6.3f, 6.3f); moveTo(17.7f, 17.7f); lineTo(19.1f, 19.1f)
        moveTo(4.9f, 19.1f); lineTo(6.3f, 17.7f); moveTo(17.7f, 6.3f); lineTo(19.1f, 4.9f)
    }

    val Moon = line("moon") {
        moveTo(20f, 14.5f); arcTo(8f, 8f, 0f, false, true, 9.5f, 4f); arcTo(8f, 8f, 0f, true, false, 20f, 14.5f); close()
    }

    val ArrowUp = line("arrow-up") {
        moveTo(12f, 19f); lineTo(12f, 5f); moveTo(6f, 11f); lineTo(12f, 5f); lineTo(18f, 11f)
    }

    val ArrowDown = line("arrow-down") {
        moveTo(12f, 5f); lineTo(12f, 17f); moveTo(6f, 11f); lineTo(12f, 17f); lineTo(18f, 11f)
    }

    val Play = line("play", filled = true) {
        moveTo(8f, 5f); lineTo(19f, 12f); lineTo(8f, 19f); close()
    }

    val Stop = line("stop", filled = true) {
        moveTo(7f, 7f); lineTo(17f, 7f); lineTo(17f, 17f); lineTo(7f, 17f); close()
    }

    val Plus = line("plus") {
        moveTo(12f, 5f); lineTo(12f, 19f); moveTo(5f, 12f); lineTo(19f, 12f)
    }

    val Close = line("close") {
        moveTo(6f, 6f); lineTo(18f, 18f); moveTo(18f, 6f); lineTo(6f, 18f)
    }

    val Trash = line("trash") {
        moveTo(4f, 7f); lineTo(20f, 7f)
        moveTo(9f, 7f); lineTo(9f, 4f); lineTo(15f, 4f); lineTo(15f, 7f)
        moveTo(6f, 7f); lineTo(7f, 20f); lineTo(17f, 20f); lineTo(18f, 7f)
    }

    val Search = line("search") {
        moveTo(17f, 11f); arcTo(6f, 6f, 0f, true, true, 5f, 11f); arcTo(6f, 6f, 0f, true, true, 17f, 11f)
        moveTo(15.5f, 15.5f); lineTo(20f, 20f)
    }

    /** Points the way "back" goes: left in a left-to-right layout, right in Arabic. */
    val Back = line("back", mirror = true) {
        moveTo(19f, 12f); lineTo(5f, 12f); moveTo(11f, 6f); lineTo(5f, 12f); lineTo(11f, 18f)
    }

    val Phone = line("phone") {
        moveTo(8f, 3f); lineTo(16f, 3f); arcTo(2f, 2f, 0f, false, true, 18f, 5f); lineTo(18f, 19f)
        arcTo(2f, 2f, 0f, false, true, 16f, 21f); lineTo(8f, 21f); arcTo(2f, 2f, 0f, false, true, 6f, 19f)
        lineTo(6f, 5f); arcTo(2f, 2f, 0f, false, true, 8f, 3f); close()
        moveTo(11f, 18f); lineTo(13f, 18f)
    }

    val Globe = line("globe") {
        moveTo(21f, 12f); arcTo(9f, 9f, 0f, true, true, 3f, 12f); arcTo(9f, 9f, 0f, true, true, 21f, 12f)
        moveTo(3f, 12f); lineTo(21f, 12f)
        moveTo(12f, 3f); curveTo(14.5f, 5.5f, 15.5f, 8.5f, 15.5f, 12f); curveTo(15.5f, 15.5f, 14.5f, 18.5f, 12f, 21f)
        curveTo(9.5f, 18.5f, 8.5f, 15.5f, 8.5f, 12f); curveTo(8.5f, 8.5f, 9.5f, 5.5f, 12f, 3f)
    }
}
