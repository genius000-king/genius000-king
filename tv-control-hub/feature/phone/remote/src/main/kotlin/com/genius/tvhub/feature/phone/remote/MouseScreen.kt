package com.genius.tvhub.feature.phone.remote

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.HubSurface
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.GlassOrb

/** The whole screen is a touchpad. No buttons: tap to click, one finger moves, two fingers scroll. */
@Composable
fun MouseScreen(onMove: (Float, Float) -> Unit, onClick: (Boolean) -> Unit, onScroll: (Float, Float) -> Unit, onBack: () -> Unit) {
    val c = Imlaq.colors
    val haptics = LocalHapticFeedback.current
    var used by remember { mutableStateOf(false) }
    val hintAlpha by animateFloatAsState(if (used) 0f else 1f, tween(600), label = "hint")
    val move by rememberUpdatedState(onMove)
    val click by rememberUpdatedState(onClick)
    val scroll by rememberUpdatedState(onScroll)
    HubSurface {
        Box(
            Modifier.fillMaxSize().pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    val perDp = 1f / density
                    used = true
                    var travelled = 0f
                    var twoFingers = false
                    var upAt = down.uptimeMillis
                    while (true) {
                        val e = awaitPointerEvent()
                        upAt = e.changes.first().uptimeMillis
                        val pressed = e.changes.filter { it.pressed }
                        if (pressed.isEmpty()) break
                        if (pressed.size >= 2) {
                            twoFingers = true
                            val d = pressed.map { it.positionChange() }.reduce { a, b -> a + b } / pressed.size.toFloat()
                            if (d != Offset.Zero) scroll(d.x * perDp * SCROLL, d.y * perDp * SCROLL)
                        } else if (!twoFingers) {
                            val d = pressed[0].positionChange()
                            travelled += d.getDistance() * perDp
                            if (d != Offset.Zero) move(d.x * perDp * GAIN, d.y * perDp * GAIN)
                        }
                        e.changes.forEach { it.consume() }
                    }
                    if (!twoFingers && travelled < TAP_SLOP_DP) {
                        // Held still for over half a second = long click (context menus).
                        click(upAt - down.uptimeMillis >= LONG_PRESS_MS)
                        haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                    }
                }
            },
        ) {
            Text(
                stringResource(R.string.mouse_hint), style = MaterialTheme.typography.titleMedium, color = c.muted, textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.Center).padding(32.dp).alpha(hintAlpha),
            )
            GlassOrb(ImlaqIcons.Back, stringResource(R.string.remote_back), onBack, Modifier.statusBarsPadding().padding(16.dp), size = 48.dp)
        }
    }
}

/**
 * Finger motion in dp to TV pixels. Measured in dp so every phone feels the same: a full swipe
 * across a phone (~360dp) carries the pointer about a third of a 1080p screen, like a laptop
 * touchpad. Fast flicks go further through the TV's gentle acceleration.
 */
private const val GAIN = 1.5f
private const val SCROLL = 4f
private const val TAP_SLOP_DP = 8f
private const val LONG_PRESS_MS = 550L
