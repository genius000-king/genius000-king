package com.genius.tvhub.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * The icons TV Control Hub adds to [ImlaqIcons], drawn the same way: 24-unit grid, 1.7 stroke,
 * round caps and joins, black and tinted by the Icon.
 */
object HubIcons {

    private fun line(name: String, filled: Boolean = false, mirror: Boolean = false, build: PathBuilder.() -> Unit) =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f, autoMirror = mirror).path(
            fill = if (filled) SolidColor(Color.Black) else null,
            stroke = if (filled) null else SolidColor(Color.Black),
            strokeLineWidth = 1.7f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            pathBuilder = build,
        ).build()

    private fun PathBuilder.circle(cx: Float, cy: Float, r: Float) {
        moveTo(cx + r, cy); arcTo(r, r, 0f, true, true, cx - r, cy); arcTo(r, r, 0f, true, true, cx + r, cy)
    }

    private fun PathBuilder.roundRect(l: Float, t: Float, r: Float, b: Float, rad: Float) {
        moveTo(l + rad, t); lineTo(r - rad, t); arcTo(rad, rad, 0f, false, true, r, t + rad)
        lineTo(r, b - rad); arcTo(rad, rad, 0f, false, true, r - rad, b)
        lineTo(l + rad, b); arcTo(rad, rad, 0f, false, true, l, b - rad)
        lineTo(l, t + rad); arcTo(rad, rad, 0f, false, true, l + rad, t); close()
    }

    // ---- navigation ----

    val Home = line("home") {
        moveTo(4f, 11f); lineTo(12f, 4f); lineTo(20f, 11f)
        moveTo(6f, 9.5f); lineTo(6f, 20f); lineTo(18f, 20f); lineTo(18f, 9.5f)
        moveTo(10f, 20f); lineTo(10f, 15f); lineTo(14f, 15f); lineTo(14f, 20f)
    }

    val Remote = line("remote") {
        roundRect(7f, 2.5f, 17f, 21.5f, 3f)
        circle(12f, 8.5f, 2.6f)
        moveTo(10f, 14f); lineTo(10f, 14.2f); moveTo(14f, 14f); lineTo(14f, 14.2f)
        moveTo(10f, 17.5f); lineTo(10f, 17.7f); moveTo(14f, 17.5f); lineTo(14f, 17.7f)
    }

    val Tv = line("tv") {
        roundRect(2.5f, 4f, 21.5f, 17f, 2f)
        moveTo(8f, 20.5f); lineTo(16f, 20.5f)
    }

    val Tools = line("tools") {
        moveTo(14.5f, 4.5f); arcTo(4.5f, 4.5f, 0f, false, false, 19.5f, 9.5f); lineTo(17f, 9.5f); lineTo(14.5f, 7f); close()
        moveTo(15.5f, 8.5f); lineTo(5f, 19f)
        moveTo(4f, 5f); lineTo(8f, 9f); moveTo(4f, 9f); lineTo(8f, 5f)
        moveTo(13f, 14f); lineTo(19f, 20f)
    }

    val ChevronEnd = line("chevron-end", mirror = true) { moveTo(9f, 5f); lineTo(16f, 12f); lineTo(9f, 19f) }
    val ChevronStart = line("chevron-start", mirror = true) { moveTo(15f, 5f); lineTo(8f, 12f); lineTo(15f, 19f) }
    val ChevronUp = line("chevron-up") { moveTo(5f, 15f); lineTo(12f, 8f); lineTo(19f, 15f) }
    val ChevronDown = line("chevron-down") { moveTo(5f, 9f); lineTo(12f, 16f); lineTo(19f, 9f) }

    // ---- device ----

    val Cpu = line("cpu") {
        roundRect(6f, 6f, 18f, 18f, 2f)
        roundRect(9.5f, 9.5f, 14.5f, 14.5f, 0.8f)
        moveTo(9f, 3f); lineTo(9f, 6f); moveTo(15f, 3f); lineTo(15f, 6f)
        moveTo(9f, 18f); lineTo(9f, 21f); moveTo(15f, 18f); lineTo(15f, 21f)
        moveTo(3f, 9f); lineTo(6f, 9f); moveTo(3f, 15f); lineTo(6f, 15f)
        moveTo(18f, 9f); lineTo(21f, 9f); moveTo(18f, 15f); lineTo(21f, 15f)
    }

    val Gpu = line("gpu") {
        roundRect(3f, 7f, 21f, 17f, 2f)
        circle(9f, 12f, 2.5f)
        moveTo(14f, 10.5f); lineTo(18f, 10.5f); moveTo(14f, 13.5f); lineTo(17f, 13.5f)
        moveTo(6f, 17f); lineTo(6f, 20f)
    }

    val Memory = line("memory") {
        roundRect(3f, 7f, 21f, 15f, 1.5f)
        moveTo(7f, 10f); lineTo(7f, 12f); moveTo(10.5f, 10f); lineTo(10.5f, 12f)
        moveTo(13.5f, 10f); lineTo(13.5f, 12f); moveTo(17f, 10f); lineTo(17f, 12f)
        moveTo(6f, 15f); lineTo(6f, 18f); moveTo(10f, 15f); lineTo(10f, 18f)
        moveTo(14f, 15f); lineTo(14f, 18f); moveTo(18f, 15f); lineTo(18f, 18f)
    }

    val Storage = line("storage") {
        moveTo(4f, 6f); curveTo(4f, 3.5f, 20f, 3.5f, 20f, 6f); curveTo(20f, 8.5f, 4f, 8.5f, 4f, 6f)
        moveTo(4f, 6f); lineTo(4f, 18f); curveTo(4f, 20.5f, 20f, 20.5f, 20f, 18f); lineTo(20f, 6f)
        moveTo(4f, 12f); curveTo(4f, 14.5f, 20f, 14.5f, 20f, 12f)
    }

    val Wifi = line("wifi") {
        moveTo(2.5f, 9f); curveTo(7.5f, 4f, 16.5f, 4f, 21.5f, 9f)
        moveTo(5.5f, 12.5f); curveTo(9f, 9f, 15f, 9f, 18.5f, 12.5f)
        moveTo(8.5f, 16f); curveTo(10.5f, 14f, 13.5f, 14f, 15.5f, 16f)
        moveTo(12f, 19.5f); lineTo(12f, 19.7f)
    }

    val Thermometer = line("thermometer") {
        moveTo(10f, 14f); lineTo(10f, 5f); arcTo(2f, 2f, 0f, false, true, 14f, 5f); lineTo(14f, 14f)
        arcTo(4f, 4f, 0f, true, true, 10f, 14f)
        moveTo(12f, 10f); lineTo(12f, 17f)
    }

    val Clock = line("clock") {
        circle(12f, 12f, 9f)
        moveTo(12f, 7f); lineTo(12f, 12f); lineTo(15.5f, 14f)
    }

    val Pulse = line("pulse") {
        moveTo(3f, 12f); lineTo(7f, 12f); lineTo(9.5f, 6f); lineTo(14.5f, 18f); lineTo(17f, 12f); lineTo(21f, 12f)
    }

    val Info = line("info") {
        circle(12f, 12f, 9f)
        moveTo(12f, 11f); lineTo(12f, 16.5f); moveTo(12f, 7.5f); lineTo(12f, 7.7f)
    }

    // ---- control ----

    val Keyboard = line("keyboard") {
        roundRect(2.5f, 6f, 21.5f, 18f, 2f)
        moveTo(6f, 9.5f); lineTo(6f, 9.7f); moveTo(9.5f, 9.5f); lineTo(9.5f, 9.7f); moveTo(13f, 9.5f); lineTo(13f, 9.7f)
        moveTo(16.5f, 9.5f); lineTo(16.5f, 9.7f); moveTo(6f, 12.5f); lineTo(6f, 12.7f); moveTo(18f, 12.5f); lineTo(18f, 12.7f)
        moveTo(8f, 15f); lineTo(16f, 15f)
    }

    val Mouse = line("mouse") {
        roundRect(6.5f, 3f, 17.5f, 21f, 5.5f)
        moveTo(12f, 3f); lineTo(12f, 9f); moveTo(6.5f, 9f); lineTo(17.5f, 9f)
    }

    val Cursor = line("cursor") {
        moveTo(5f, 3f); lineTo(19f, 12.5f); lineTo(12.5f, 13.5f); lineTo(16f, 20f); lineTo(13.5f, 21f); lineTo(10f, 14.5f); lineTo(5f, 19f); close()
    }

    val Bolt = line("bolt") {
        moveTo(13f, 2.5f); lineTo(5f, 13.5f); lineTo(11.5f, 13.5f); lineTo(10.5f, 21.5f); lineTo(19f, 10f); lineTo(12.5f, 10f); close()
    }

    val Power = line("power") {
        moveTo(12f, 3f); lineTo(12f, 11f)
        moveTo(7f, 6.3f); arcTo(8f, 8f, 0f, true, false, 17f, 6.3f)
    }

    val VolumeUp = line("volume-up") {
        moveTo(4f, 9f); lineTo(8f, 9f); lineTo(13f, 5f); lineTo(13f, 19f); lineTo(8f, 15f); lineTo(4f, 15f); close()
        moveTo(16f, 12f); lineTo(21f, 12f); moveTo(18.5f, 9.5f); lineTo(18.5f, 14.5f)
    }

    val VolumeDown = line("volume-down") {
        moveTo(4f, 9f); lineTo(8f, 9f); lineTo(13f, 5f); lineTo(13f, 19f); lineTo(8f, 15f); lineTo(4f, 15f); close()
        moveTo(16f, 12f); lineTo(21f, 12f)
    }

    val Mute = line("mute") {
        moveTo(4f, 9f); lineTo(8f, 9f); lineTo(13f, 5f); lineTo(13f, 19f); lineTo(8f, 15f); lineTo(4f, 15f); close()
        moveTo(16.5f, 9.5f); lineTo(21f, 14f); moveTo(21f, 9.5f); lineTo(16.5f, 14f)
    }

    val PlayPause = line("play-pause") {
        moveTo(4f, 6f); lineTo(12f, 12f); lineTo(4f, 18f); close()
        moveTo(15.5f, 6f); lineTo(15.5f, 18f); moveTo(19.5f, 6f); lineTo(19.5f, 18f)
    }

    val Next = line("next", mirror = true) {
        moveTo(5f, 6f); lineTo(14f, 12f); lineTo(5f, 18f); close(); moveTo(18f, 6f); lineTo(18f, 18f)
    }

    val Previous = line("previous", mirror = true) {
        moveTo(19f, 6f); lineTo(10f, 12f); lineTo(19f, 18f); close(); moveTo(6f, 6f); lineTo(6f, 18f)
    }

    val Recents = line("recents") {
        roundRect(4f, 4f, 11f, 11f, 1.5f); roundRect(13f, 4f, 20f, 11f, 1.5f)
        roundRect(4f, 13f, 11f, 20f, 1.5f); roundRect(13f, 13f, 20f, 20f, 1.5f)
    }

    val Fullscreen = line("fullscreen") {
        moveTo(4f, 9f); lineTo(4f, 4f); lineTo(9f, 4f); moveTo(15f, 4f); lineTo(20f, 4f); lineTo(20f, 9f)
        moveTo(20f, 15f); lineTo(20f, 20f); lineTo(15f, 20f); moveTo(9f, 20f); lineTo(4f, 20f); lineTo(4f, 15f)
    }

    val Rotate = line("rotate") {
        moveTo(20f, 12f); arcTo(8f, 8f, 0f, true, true, 17.6f, 6.3f)
        moveTo(18f, 2.5f); lineTo(18f, 6.5f); lineTo(14f, 6.5f)
    }

    val Gesture = line("gesture") {
        moveTo(9f, 11f); lineTo(9f, 5f); arcTo(1.5f, 1.5f, 0f, false, true, 12f, 5f); lineTo(12f, 10f)
        lineTo(12f, 8.5f); arcTo(1.5f, 1.5f, 0f, false, true, 15f, 8.5f); lineTo(15f, 10.5f)
        arcTo(1.5f, 1.5f, 0f, false, true, 18f, 10.5f); lineTo(18f, 15f); curveTo(18f, 19f, 15.5f, 21f, 12.5f, 21f)
        curveTo(10f, 21f, 8.5f, 19.5f, 7f, 17.5f); lineTo(5f, 14.5f); arcTo(1.5f, 1.5f, 0f, false, true, 7.5f, 12.8f); lineTo(9f, 14.5f)
    }

    // ---- tools ----

    val Apps = line("apps") {
        circle(7f, 7f, 2.5f); circle(17f, 7f, 2.5f); circle(7f, 17f, 2.5f); circle(17f, 17f, 2.5f)
    }

    val Folder = line("folder") {
        moveTo(3f, 7f); arcTo(2f, 2f, 0f, false, true, 5f, 5f); lineTo(9.5f, 5f); lineTo(11.5f, 7.5f); lineTo(19f, 7.5f)
        arcTo(2f, 2f, 0f, false, true, 21f, 9.5f); lineTo(21f, 17f); arcTo(2f, 2f, 0f, false, true, 19f, 19f)
        lineTo(5f, 19f); arcTo(2f, 2f, 0f, false, true, 3f, 17f); close()
    }

    val Terminal = line("terminal") {
        roundRect(2.5f, 4f, 21.5f, 20f, 2f)
        moveTo(6.5f, 9f); lineTo(10f, 12f); lineTo(6.5f, 15f); moveTo(12f, 15.5f); lineTo(17f, 15.5f)
    }

    val Server = line("server") {
        roundRect(3f, 3.5f, 21f, 10.5f, 2f); roundRect(3f, 13.5f, 21f, 20.5f, 2f)
        moveTo(7f, 7f); lineTo(7f, 7.2f); moveTo(7f, 17f); lineTo(7f, 17.2f)
        moveTo(11f, 7f); lineTo(17f, 7f); moveTo(11f, 17f); lineTo(17f, 17f)
    }

    val Package = line("package") {
        moveTo(12f, 2.8f); lineTo(20.5f, 7.5f); lineTo(20.5f, 16.5f); lineTo(12f, 21.2f); lineTo(3.5f, 16.5f); lineTo(3.5f, 7.5f); close()
        moveTo(3.5f, 7.5f); lineTo(12f, 12.2f); lineTo(20.5f, 7.5f); moveTo(12f, 12.2f); lineTo(12f, 21.2f)
        moveTo(7.75f, 5.15f); lineTo(16.25f, 9.85f)
    }

    val Beam = line("beam", mirror = true) {
        moveTo(3f, 11.5f); lineTo(21f, 3f); lineTo(14f, 21f); lineTo(11f, 13.5f); close()
        moveTo(11f, 13.5f); lineTo(21f, 3f)
    }

    val Upload = line("upload") {
        moveTo(12f, 15f); lineTo(12f, 4f); moveTo(7.5f, 8.5f); lineTo(12f, 4f); lineTo(16.5f, 8.5f)
        moveTo(4f, 15f); lineTo(4f, 19f); lineTo(20f, 19f); lineTo(20f, 15f)
    }

    val Download = line("download") {
        moveTo(12f, 4f); lineTo(12f, 15f); moveTo(7.5f, 10.5f); lineTo(12f, 15f); lineTo(16.5f, 10.5f)
        moveTo(4f, 15f); lineTo(4f, 19f); lineTo(20f, 19f); lineTo(20f, 15f)
    }

    val Copy = line("copy") {
        roundRect(8f, 8f, 20f, 20f, 2f)
        moveTo(16f, 8f); lineTo(16f, 6f); arcTo(2f, 2f, 0f, false, false, 14f, 4f); lineTo(6f, 4f)
        arcTo(2f, 2f, 0f, false, false, 4f, 6f); lineTo(4f, 14f); arcTo(2f, 2f, 0f, false, false, 6f, 16f); lineTo(8f, 16f)
    }

    val Move = line("move", mirror = true) {
        moveTo(4f, 12f); lineTo(19f, 12f); moveTo(14f, 7f); lineTo(19f, 12f); lineTo(14f, 17f)
    }

    val Refresh = line("refresh") {
        moveTo(20f, 12f); arcTo(8f, 8f, 0f, true, true, 17.6f, 6.3f)
        moveTo(18f, 2.5f); lineTo(18f, 6.5f); lineTo(14f, 6.5f)
    }

    val Logs = line("logs") {
        moveTo(8f, 6f); lineTo(20f, 6f); moveTo(8f, 12f); lineTo(20f, 12f); moveTo(8f, 18f); lineTo(16f, 18f)
        moveTo(4f, 6f); lineTo(4f, 6.2f); moveTo(4f, 12f); lineTo(4f, 12.2f); moveTo(4f, 18f); lineTo(4f, 18.2f)
    }

    val Star = line("star") {
        moveTo(12f, 3.5f); lineTo(14.6f, 8.9f); lineTo(20.5f, 9.6f); lineTo(16.2f, 13.6f); lineTo(17.3f, 19.5f)
        lineTo(12f, 16.6f); lineTo(6.7f, 19.5f); lineTo(7.8f, 13.6f); lineTo(3.5f, 9.6f); lineTo(9.4f, 8.9f); close()
    }

    val Check = line("check") { moveTo(5f, 12.5f); lineTo(10f, 17.5f); lineTo(19f, 7f) }

    val Warning = line("warning") {
        moveTo(12f, 3.5f); lineTo(21.5f, 20f); lineTo(2.5f, 20f); close()
        moveTo(12f, 9.5f); lineTo(12f, 14f); moveTo(12f, 17f); lineTo(12f, 17.2f)
    }

    // ---- settings ----

    val Link = line("link") {
        moveTo(10f, 14f); arcTo(4f, 4f, 0f, false, false, 15.66f, 14f); lineTo(18.5f, 11.17f)
        arcTo(4f, 4f, 0f, false, false, 12.83f, 5.5f); lineTo(11.5f, 6.83f)
        moveTo(14f, 10f); arcTo(4f, 4f, 0f, false, false, 8.34f, 10f); lineTo(5.5f, 12.83f)
        arcTo(4f, 4f, 0f, false, false, 11.17f, 18.5f); lineTo(12.5f, 17.17f)
    }

    val Shield = line("shield") {
        moveTo(12f, 3f); lineTo(19.5f, 6f); lineTo(19.5f, 11.5f); curveTo(19.5f, 16f, 16.5f, 19.5f, 12f, 21f)
        curveTo(7.5f, 19.5f, 4.5f, 16f, 4.5f, 11.5f); lineTo(4.5f, 6f); close()
        moveTo(8.5f, 12f); lineTo(11f, 14.5f); lineTo(15.5f, 9.5f)
    }

    val Lock = line("lock") {
        roundRect(5f, 10.5f, 19f, 20.5f, 2f)
        moveTo(8f, 10.5f); lineTo(8f, 7.5f); arcTo(4f, 4f, 0f, false, true, 16f, 7.5f); lineTo(16f, 10.5f)
        moveTo(12f, 14.5f); lineTo(12f, 16.5f)
    }

    val Palette = line("palette") {
        moveTo(12f, 3f); curveTo(7f, 3f, 3f, 7f, 3f, 12f); curveTo(3f, 17f, 7f, 21f, 12f, 21f)
        curveTo(13.5f, 21f, 14f, 20f, 13.5f, 18.5f); curveTo(13f, 17f, 14f, 15.5f, 15.5f, 15.5f); lineTo(17f, 15.5f)
        curveTo(19.5f, 15.5f, 21f, 14f, 21f, 11.5f); curveTo(21f, 6.8f, 17f, 3f, 12f, 3f); close()
        moveTo(7.5f, 11f); lineTo(7.5f, 11.2f); moveTo(10.5f, 7f); lineTo(10.5f, 7.2f); moveTo(15f, 7.5f); lineTo(15f, 7.7f)
    }

    val Devices = line("devices") {
        roundRect(2.5f, 4.5f, 16f, 14f, 1.5f); moveTo(6f, 17.5f); lineTo(12f, 17.5f)
        roundRect(16.5f, 8f, 21.5f, 19.5f, 1.5f)
    }

    val Key = line("key") {
        circle(8f, 15f, 4.5f)
        moveTo(11.2f, 11.8f); lineTo(20f, 3f); moveTo(16.5f, 6.5f); lineTo(19f, 9f); moveTo(14f, 9f); lineTo(16f, 11f)
    }

    val Diagnostics = line("diagnostics") {
        circle(10.5f, 10.5f, 6.5f)
        moveTo(15.2f, 15.2f); lineTo(20f, 20f)
        moveTo(7f, 10.5f); lineTo(9f, 10.5f); lineTo(10f, 8f); lineTo(11.5f, 13f); lineTo(12.5f, 10.5f); lineTo(14f, 10.5f)
    }

    val Launcher = line("launcher") {
        roundRect(3f, 3f, 10f, 10f, 2.2f); roundRect(14f, 3f, 21f, 10f, 2.2f)
        roundRect(3f, 14f, 10f, 21f, 2.2f); roundRect(14f, 14f, 21f, 21f, 2.2f)
    }
}
