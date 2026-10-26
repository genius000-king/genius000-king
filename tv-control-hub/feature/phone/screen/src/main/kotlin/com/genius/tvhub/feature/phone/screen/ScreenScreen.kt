package com.genius.tvhub.feature.phone.screen

import android.content.pm.ActivityInfo
import android.view.SurfaceHolder
import android.view.SurfaceView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.activity.compose.LocalActivity
import com.genius.tvhub.core.protocol.EndReason
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.tvhub.core.designsystem.GlassOrb
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.PulseDot
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.engine.stream.decode.VideoDecoder
import kotlinx.coroutines.delay

/**
 * The TV on the phone. Landscape by itself, touches land where you touch, the controls fade away
 * after three seconds and come back when you touch the bottom edge.
 */
@Composable
fun ScreenRoute(onClose: () -> Unit, onKeyboard: () -> Unit, vm: ScreenViewModel = hiltViewModel()) {
    val status by vm.status.collectAsStateWithLifecycle()
    val activity = LocalActivity.current
    DisposableEffect(Unit) {
        val before = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose { vm.stop(); activity?.requestedOrientation = before ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }
    var controls by remember { mutableStateOf(true) }
    LaunchedEffect(controls) { if (controls) { delay(3_000); controls = false } }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        val ratio = (status as? ScreenStatus.Playing)?.let { it.width.toFloat() / it.height } ?: (16f / 9f)
        val size = remember { mutableStateOf(IntSize.Zero) }
        Box(Modifier.align(Alignment.Center).aspectRatio(ratio).onSizeChanged { size.value = it }) {
            AndroidView(factory = { ctx ->
                SurfaceView(ctx).apply {
                    holder.addCallback(object : SurfaceHolder.Callback {
                        var decoder: VideoDecoder? = null
                        override fun surfaceCreated(h: SurfaceHolder) {
                            decoder = VideoDecoder(h.surface, vm::requestKeyFrame).also { d -> vm.start(d::offer) }
                        }
                        override fun surfaceChanged(h: SurfaceHolder, f: Int, w: Int, ht: Int) = Unit
                        override fun surfaceDestroyed(h: SurfaceHolder) { vm.stop(); decoder?.close(); decoder = null }
                    })
                }
            }, modifier = Modifier.fillMaxSize())
            val playing = status as? ScreenStatus.Playing
            if (playing != null) TouchLayer(TouchMapper(size.value.width.toFloat(), size.value.height.toFloat(), playing.width, playing.height), vm) { controls = true }
        }
        when (val s = status) {
            ScreenStatus.Starting -> Centered { PulseDot(Imlaq.colors.text, size = 10.dp); Text(stringResource(R.string.screen_connecting), color = Imlaq.colors.text, style = MaterialTheme.typography.titleMedium); Text(stringResource(R.string.screen_tv_prompt), color = Imlaq.colors.muted, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
            is ScreenStatus.Failed -> Centered {
                Text(
                    stringResource(
                        when (s.reason) {
                            EndReason.NOT_ALLOWED -> R.string.screen_not_allowed
                            EndReason.CAPTURE_FAILED -> R.string.screen_capture_failed
                            else -> R.string.screen_failed
                        },
                    ),
                    color = Imlaq.colors.text, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(32.dp),
                )
            }
            is ScreenStatus.Playing -> Unit
        }
        AnimatedVisibility(controls, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.BottomCenter)) {
            Row(Modifier.navigationBarsPadding().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                GlassOrb(ImlaqIcons.Back, stringResource(R.string.screen_back), { vm.key(KeyAction.BACK) }, size = 48.dp)
                GlassOrb(HubIcons.Keyboard, stringResource(R.string.screen_keyboard), onKeyboard, size = 48.dp)
                GlassOrb(ImlaqIcons.Close, stringResource(R.string.screen_close), onClose, size = 48.dp)
            }
        }
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 360.dp).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}

/** Tap, long press and drag on the picture become the same gestures on the TV. */
@Composable
private fun TouchLayer(mapper: TouchMapper, vm: ScreenViewModel, onTouch: () -> Unit) {
    Box(Modifier.fillMaxSize().pointerInput(mapper) {
        awaitEachGesture {
            val down = awaitFirstDown()
            onTouch()
            val path = mutableListOf<NormPoint>()
            mapper.map(down.position.x, down.position.y)?.let(path::add)
            var last = down.uptimeMillis
            while (true) {
                val e = awaitPointerEvent()
                val c = e.changes.first()
                last = c.uptimeMillis
                if (!c.pressed) break
                mapper.map(c.position.x, c.position.y)?.let { p -> if (path.isEmpty() || dist(path.last(), p) > 0.01f) path += p }
                c.consume()
            }
            val held = last - down.uptimeMillis
            when {
                path.isEmpty() -> Unit
                path.size == 1 || dist(path.first(), path.last()) < 0.015f -> if (held > 550) vm.longPress(path.first()) else vm.tap(path.first())
                else -> vm.swipe(path.takeLast(40), held.coerceIn(80, 1500))
            }
        }
    })
}

private fun dist(a: NormPoint, b: NormPoint) = kotlin.math.hypot(a.x - b.x, a.y - b.y)
