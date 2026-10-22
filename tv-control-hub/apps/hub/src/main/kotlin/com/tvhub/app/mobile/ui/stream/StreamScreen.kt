package com.tvhub.app.mobile.ui.stream

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tvhub.design.LocalBrandPalette
import com.tvhub.input.Dimensions
import com.tvhub.input.ViewportMapper
import com.tvhub.input.VideoPoint
import com.tvhub.app.R
import com.tvhub.protocol.NavAction
import com.tvhub.protocol.StreamProfile
import com.tvhub.stream.mobile.RemoteVideoView
import com.tvhub.stream.mobile.ViewerPeer

private val videoFrame = Dimensions(StreamProfile.WIDTH.toFloat(), StreamProfile.HEIGHT.toFloat())

/** The live-screen page: connect to the TV, watch its screen, and send taps and navigation keys back. */
@Composable
fun StreamScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: StreamViewModel = viewModel(),
) {
    val status by viewModel.status.collectAsStateWithLifecycle()
    var host by rememberSaveable { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StreamHeader(onBack = onBack)
        OutlinedTextField(
            value = host,
            onValueChange = { host = it },
            label = { Text(stringResource(R.string.stream_host_label)) },
            placeholder = { Text(stringResource(R.string.stream_host_hint)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth(),
        )
        ConnectRow(
            status = status,
            canConnect = host.isNotBlank() && status != ConnectionStatus.Connecting,
            onConnect = { viewModel.connect(host.trim()) },
        )
        VideoSurface(viewer = viewModel.viewer, onTap = viewModel::tap)
        Text(
            text = stringResource(R.string.stream_tap_hint),
            style = MaterialTheme.typography.bodySmall,
            color = LocalBrandPalette.current.contentTertiary,
        )
        NavRow(onNavigate = viewModel::navigate)
    }
}

@Composable
private fun StreamHeader(onBack: () -> Unit) {
    val palette = LocalBrandPalette.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = stringResource(R.string.action_back),
            tint = palette.content,
            modifier = Modifier
                .clickable(onClick = onBack)
                .padding(8.dp),
        )
        Text(
            text = stringResource(R.string.page_stream),
            style = MaterialTheme.typography.titleLarge,
            color = palette.content,
        )
    }
}

@Composable
private fun ConnectRow(status: ConnectionStatus, canConnect: Boolean, onConnect: () -> Unit) {
    val palette = LocalBrandPalette.current
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Button(onClick = onConnect, enabled = canConnect) {
            Text(stringResource(R.string.stream_connect))
        }
        Text(
            text = statusText(status),
            style = MaterialTheme.typography.bodyMedium,
            color = if (status is ConnectionStatus.Failed) palette.error else palette.contentSecondary,
        )
    }
}

/**
 * The TV picture, with a transparent overlay on top. The overlay receives the touch,
 * so taps reach Compose and not the native video view underneath.
 */
@Composable
private fun VideoSurface(viewer: ViewerPeer, onTap: (VideoPoint) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(videoFrame.width / videoFrame.height)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black),
    ) {
        RemoteVideoView(viewer = viewer, modifier = Modifier.fillMaxSize())
        Box(
            modifier = Modifier
                .matchParentSize()
                .pointerInput(Unit) {
                    detectTapGestures { offset ->
                        val view = Dimensions(size.width.toFloat(), size.height.toFloat())
                        ViewportMapper.toVideoPoint(offset.x, offset.y, view, videoFrame)?.let(onTap)
                    }
                },
        )
    }
}

@Composable
private fun NavRow(onNavigate: (NavAction) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        NavButton(R.string.nav_back) { onNavigate(NavAction.BACK) }
        NavButton(R.string.nav_home) { onNavigate(NavAction.HOME) }
        NavButton(R.string.nav_recents) { onNavigate(NavAction.RECENTS) }
    }
}

@Composable
private fun NavButton(label: Int, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick) {
        Text(stringResource(label))
    }
}

@Composable
private fun statusText(status: ConnectionStatus): String = when (status) {
    ConnectionStatus.Idle -> stringResource(R.string.stream_status_idle)
    ConnectionStatus.Connecting -> stringResource(R.string.stream_status_connecting)
    ConnectionStatus.Connected -> stringResource(R.string.stream_status_connected)
    is ConnectionStatus.Failed -> stringResource(R.string.stream_status_failed, status.reason)
}
