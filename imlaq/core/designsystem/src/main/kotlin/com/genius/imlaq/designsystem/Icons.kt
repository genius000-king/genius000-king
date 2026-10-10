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

    // ---- what a model does ----

    val Chat = line("chat") {
        moveTo(5f, 4f); lineTo(19f, 4f); arcTo(2f, 2f, 0f, false, true, 21f, 6f); lineTo(21f, 15f)
        arcTo(2f, 2f, 0f, false, true, 19f, 17f); lineTo(10f, 17f); lineTo(5f, 21f); lineTo(5f, 17f)
        arcTo(2f, 2f, 0f, false, true, 3f, 15f); lineTo(3f, 6f); arcTo(2f, 2f, 0f, false, true, 5f, 4f); close()
        moveTo(8f, 9f); lineTo(16f, 9f); moveTo(8f, 12.5f); lineTo(13f, 12.5f)
    }

    val Eye = line("eye") {
        moveTo(2f, 12f); curveTo(4.5f, 7f, 8f, 5f, 12f, 5f); curveTo(16f, 5f, 19.5f, 7f, 22f, 12f)
        curveTo(19.5f, 17f, 16f, 19f, 12f, 19f); curveTo(8f, 19f, 4.5f, 17f, 2f, 12f); close()
        moveTo(15f, 12f); arcTo(3f, 3f, 0f, true, true, 9f, 12f); arcTo(3f, 3f, 0f, true, true, 15f, 12f)
    }

    val Picture = line("picture") {
        moveTo(5f, 4f); lineTo(19f, 4f); arcTo(2f, 2f, 0f, false, true, 21f, 6f); lineTo(21f, 18f)
        arcTo(2f, 2f, 0f, false, true, 19f, 20f); lineTo(5f, 20f); arcTo(2f, 2f, 0f, false, true, 3f, 18f)
        lineTo(3f, 6f); arcTo(2f, 2f, 0f, false, true, 5f, 4f); close()
        moveTo(3f, 16f); lineTo(8.5f, 11f); lineTo(13f, 15f); lineTo(16f, 12.5f); lineTo(21f, 17f)
        moveTo(17f, 8.5f); arcTo(1.5f, 1.5f, 0f, true, true, 14f, 8.5f); arcTo(1.5f, 1.5f, 0f, true, true, 17f, 8.5f)
    }

    val Film = line("film") {
        moveTo(5f, 4f); lineTo(19f, 4f); arcTo(2f, 2f, 0f, false, true, 21f, 6f); lineTo(21f, 18f)
        arcTo(2f, 2f, 0f, false, true, 19f, 20f); lineTo(5f, 20f); arcTo(2f, 2f, 0f, false, true, 3f, 18f)
        lineTo(3f, 6f); arcTo(2f, 2f, 0f, false, true, 5f, 4f); close()
        moveTo(7f, 4f); lineTo(7f, 20f); moveTo(17f, 4f); lineTo(17f, 20f)
        moveTo(3f, 9f); lineTo(7f, 9f); moveTo(3f, 15f); lineTo(7f, 15f)
        moveTo(17f, 9f); lineTo(21f, 9f); moveTo(17f, 15f); lineTo(21f, 15f)
    }

    val Mic = line("mic") {
        moveTo(12f, 3f); arcTo(3f, 3f, 0f, false, true, 15f, 6f); lineTo(15f, 11f)
        arcTo(3f, 3f, 0f, false, true, 9f, 11f); lineTo(9f, 6f); arcTo(3f, 3f, 0f, false, true, 12f, 3f); close()
        moveTo(5.5f, 11f); arcTo(6.5f, 6.5f, 0f, false, false, 18.5f, 11f)
        moveTo(12f, 17.5f); lineTo(12f, 21f)
    }

    val Speaker = line("speaker") {
        moveTo(4f, 9f); lineTo(8f, 9f); lineTo(13f, 5f); lineTo(13f, 19f); lineTo(8f, 15f); lineTo(4f, 15f); close()
        moveTo(16.5f, 9f); curveTo(17.5f, 10.5f, 17.5f, 13.5f, 16.5f, 15f)
        moveTo(19f, 6.5f); curveTo(21.5f, 9.5f, 21.5f, 14.5f, 19f, 17.5f)
    }

    val Layers = line("layers") {
        moveTo(12f, 3f); lineTo(21f, 8f); lineTo(12f, 13f); lineTo(3f, 8f); close()
        moveTo(3f, 12f); lineTo(12f, 17f); lineTo(21f, 12f)
        moveTo(3f, 16f); lineTo(12f, 21f); lineTo(21f, 16f)
    }

    val Question = line("question") {
        moveTo(21f, 12f); arcTo(9f, 9f, 0f, true, true, 3f, 12f); arcTo(9f, 9f, 0f, true, true, 21f, 12f)
        moveTo(9.5f, 9.5f); curveTo(9.5f, 6.5f, 14.5f, 6.5f, 14.5f, 9.5f); curveTo(14.5f, 11.5f, 12f, 11.5f, 12f, 13.5f)
        moveTo(12f, 16.8f); lineTo(12f, 17f)
    }
}
