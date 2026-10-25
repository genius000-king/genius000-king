package com.genius.tvhub.feature.phone.remote

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.animation.core.animateFloat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The remote's surface. Swipe = arrows (hold to repeat), tap = OK, two fingers spreading = open
 * the live screen. The finger leaves a soft cream trail and the arrow that fired flashes.
 */
@Composable
fun GesturePad(
    onSwipe: (Swipe) -> Unit,
    onTap: () -> Unit,
    onPinchOut: () -> Unit,
    modifier: Modifier = Modifier,
    overlay: @Composable BoxScope.() -> Unit = {},
) {
    val c = Imlaq.colors
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val trigger = with(LocalDensity.current) { 28.dp.toPx() }
    val classifier = remember(trigger) { SwipeClassifier(trigger) }
    val trail = remember { mutableStateListOf<Offset>() }
    var flash by remember { mutableStateOf<Swipe?>(null) }
    val flashAnim = remember { Animatable(0f) }
    val swipe by rememberUpdatedState(onSwipe)
    val tap by rememberUpdatedState(onTap)
    val pinch by rememberUpdatedState(onPinchOut)

    fun fire(s: Swipe) {
        swipe(s)
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        flash = s
        scope.launch { flashAnim.snapTo(1f); flashAnim.animateTo(0f, tween(420)) }
    }

    Box(
        modifier
            .fillMaxSize()
            .pointerInput(classifier) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    trail.clear(); trail += down.position
                    var origin = down.position
                    var fired: Swipe? = null
                    var repeatJob: Job? = null
                    var moved = false
                    var startSpan = 0f
                    var pinched = false
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Main)
                        val pressed = event.changes.filter { it.pressed }
                        if (pressed.isEmpty()) break
                        if (pressed.size >= 2) {
                            val span = (pressed[0].position - pressed[1].position).getDistance()
                            if (startSpan == 0f) startSpan = span
                            if (!pinched && span > startSpan * 1.45f) { pinched = true; pinch() }
                            repeatJob?.cancel(); moved = true
                            continue
                        }
                        val change = pressed.first()
                        if (change.positionChange() != Offset.Zero) {
                            trail += change.position
                            if (trail.size > 24) trail.removeAt(0)
                        }
                        val delta = change.position - origin
                        if (delta.getDistance() > trigger / 3) moved = true
                        val s = classifier.classify(delta.x, delta.y)
                        if (s != null) {
                            fire(s)
                            fired = s
                            origin = change.position
                            repeatJob?.cancel()
                            repeatJob = scope.launch {
                                var i = 0
                                while (true) { delay(SwipeClassifier.repeatDelay(i++)); fire(s) }
                            }
                        }
                        change.consume()
                    }
                    repeatJob?.cancel()
                    if (!moved && fired == null && !pinched) {
                        tap()
                        haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                    }
                    scope.launch { delay(120); trail.clear() }
                }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val n = trail.size
            trail.forEachIndexed { i, p ->
                val a = (i + 1f) / n
                drawCircle(Brush.radialGradient(listOf(c.text.copy(alpha = 0.22f * a), Color.Transparent), p, 46.dp.toPx() * (0.5f + a / 2)), 46.dp.toPx() * (0.5f + a / 2), p)
            }
        }
        GuideRing(lit = flash, intensity = flashAnim.value, modifier = Modifier.align(Alignment.Center))
        overlay()
        flash?.let { s ->
            Arrow(s, c.text, Modifier.align(Alignment.Center).size(72.dp).alpha(flashAnim.value).scale(1f + 0.25f * (1f - flashAnim.value)))
        }
    }
}

/** Swipes are physical, so their arrows never mirror: one up-chevron, rotated. */
@Composable
private fun Arrow(s: Swipe, tint: Color, modifier: Modifier) {
    val degrees = when (s) { Swipe.UP -> 0f; Swipe.RIGHT -> 90f; Swipe.DOWN -> 180f; Swipe.LEFT -> 270f }
    Icon(HubIcons.ChevronUp, null, tint = tint, modifier = modifier.rotate(degrees))
}

/**
 * A faint ring with four arrows: tells the eye "this whole area is the remote" without a single
 * button. The arrow of the last swipe lights up and fades.
 */
@Composable
private fun GuideRing(lit: Swipe?, intensity: Float, modifier: Modifier) {
    val c = Imlaq.colors
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "ring")
    val breathe by t.animateFloat(0.96f, 1.04f, androidx.compose.animation.core.infiniteRepeatable(tween(2600), androidx.compose.animation.core.RepeatMode.Reverse), label = "b")
    Box(modifier.size(260.dp).scale(breathe), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(c.text.copy(alpha = 0.07f), style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()))
            drawCircle(c.text.copy(alpha = 0.05f), radius = size.minDimension * 0.18f, style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()))
        }
        androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Ltr) {
            listOf(Swipe.UP to Alignment.TopCenter, Swipe.DOWN to Alignment.BottomCenter, Swipe.LEFT to Alignment.CenterStart, Swipe.RIGHT to Alignment.CenterEnd).forEach { (s, at) ->
                val a = 0.18f + if (s == lit) 0.82f * intensity else 0f
                Arrow(s, c.text.copy(alpha = a), Modifier.align(at).padding(18.dp).size(22.dp))
            }
        }
    }
}
