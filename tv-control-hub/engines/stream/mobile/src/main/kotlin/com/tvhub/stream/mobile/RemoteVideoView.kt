package com.tvhub.stream.mobile

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer

/** Draws the TV's video track. Letterboxes it, so the frame keeps the TV's aspect ratio. */
@Composable
fun RemoteVideoView(
    viewer: ViewerPeer,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val track by viewer.track.collectAsState()

    val renderer = remember(viewer) {
        SurfaceViewRenderer(context).apply {
            init(viewer.eglContext, null)
            setEnableHardwareScaler(true)
            setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
        }
    }

    DisposableEffect(track, renderer) {
        track?.addSink(renderer)
        onDispose { track?.removeSink(renderer) }
    }
    DisposableEffect(renderer) {
        onDispose { renderer.release() }
    }

    AndroidView(
        factory = { renderer },
        modifier = modifier.fillMaxSize(),
    )
}
