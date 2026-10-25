package com.genius.tvhub.feature.phone.remote

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.genius.tvhub.core.designsystem.GhostButton
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.PillButton
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.PulseDot
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.model.LinkFailure
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.model.TvEndpoint

/** The one capsule at the top: who you control and how fast. Tap = the TV's pulse. */
@Composable
fun StatusCapsule(state: LinkState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    val (name, dotColor, pulsing, extra) = when (state) {
        is LinkState.Connected -> Quad(state.tv.name, c.ok, false, state.latencyMillis?.let { "$it ms" })
        is LinkState.Connecting -> Quad(state.tv.name, c.warn, true, null)
        is LinkState.Reconnecting -> Quad(state.tv.name, c.warn, true, stringResource(R.string.link_reconnecting))
        is LinkState.AwaitingApproval -> Quad(state.tv.name, c.warn, true, null)
        is LinkState.Failed -> Quad(state.tv?.name ?: "TV", c.bad, false, null)
        is LinkState.Searching -> Quad("TV", c.faint, true, null)
    }
    Row(
        modifier
            .glass(PillShape, strong = true)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (pulsing) PulseDot(dotColor) else PulseDot(dotColor.copy(alpha = 1f), size = 8.dp)
        Text(name, style = MaterialTheme.typography.labelMedium, color = c.text, maxLines = 1)
        if (extra != null) {
            Text("·", color = c.faint)
            Text(extra, style = MaterialTheme.typography.labelSmall.copy(textDirection = TextDirection.ContentOrLtr), color = c.muted, maxLines = 1)
        }
    }
}

private data class Quad(val a: String, val b: androidx.compose.ui.graphics.Color, val c: Boolean, val d: String?)

/** Expanding rings: the phone is listening for TVs. */
@Composable
fun Radar(modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    val t = rememberInfiniteTransition(label = "radar")
    val p by t.animateFloat(0f, 1f, infiniteRepeatable(tween(2200)), label = "p")
    Canvas(modifier.size(180.dp)) {
        for (k in 0 until 3) {
            val f = (p + k / 3f) % 1f
            drawCircle(c.text.copy(alpha = (1f - f) * 0.35f), radius = size.minDimension / 2 * f, style = Stroke(1.dp.toPx()))
        }
        drawCircle(c.text, radius = 5.dp.toPx())
    }
}

@Composable
fun SearchingView(state: LinkState.Searching, onConnect: (TvEndpoint) -> Unit, onManual: () -> Unit, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Radar()
        Text(stringResource(R.string.link_searching), style = MaterialTheme.typography.titleLarge, color = c.text)
        if (state.found.isEmpty()) {
            Text(stringResource(R.string.link_searching_tip), style = MaterialTheme.typography.bodyMedium, color = c.muted, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 280.dp))
            GhostButton(stringResource(R.string.link_manual), onManual)
        } else {
            Spacer(Modifier.height(4.dp))
            state.found.forEach { tv -> PillButton(tv.name, { onConnect(tv) }, icon = HubIcons.Tv) }
        }
    }
}

@Composable
fun ConnectingView(name: String, reconnecting: Boolean, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Radar()
        Text(
            if (reconnecting) stringResource(R.string.link_reconnecting) else stringResource(R.string.link_connecting, name),
            style = MaterialTheme.typography.titleMedium, color = c.muted,
        )
    }
}

/** The six digits, big, with the one instruction that matters. */
@Composable
fun ApprovalView(code: String, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    val t = rememberInfiniteTransition(label = "approve")
    val glow by t.animateFloat(0.55f, 1f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "g")
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Icon(HubIcons.Remote, null, tint = c.text, modifier = Modifier.size(34.dp).alpha(glow))
        Text(stringResource(R.string.link_approve_title), style = MaterialTheme.typography.titleLarge, color = c.text, textAlign = TextAlign.Center)
        // Digits read left to right in every language: force LTR so Arabic does not reverse the code.
        androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Ltr) { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            code.forEachIndexed { i, d ->
                if (i == 3) Spacer(Modifier.width(10.dp))
                Box(Modifier.size(width = 40.dp, height = 54.dp).glass(androidx.compose.foundation.shape.RoundedCornerShape(14.dp), strong = true), contentAlignment = Alignment.Center) {
                    Text(d.toString(), fontSize = 26.sp, style = MaterialTheme.typography.headlineMedium, color = c.text)
                }
            }
        } }
        Text(stringResource(R.string.link_approve_body), style = MaterialTheme.typography.bodyMedium, color = c.muted)
    }
}

@Composable
fun FailedView(failure: LinkFailure, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    val text = when (failure) {
        LinkFailure.NO_NETWORK -> R.string.link_fail_no_network
        LinkFailure.NOT_FOUND -> R.string.link_fail_not_found
        LinkFailure.REFUSED -> R.string.link_fail_refused
        LinkFailure.KEY_CHANGED -> R.string.link_fail_key_changed
        LinkFailure.VERSION_MISMATCH -> R.string.link_fail_version
        LinkFailure.UNREACHABLE -> R.string.link_fail_unreachable
    }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Icon(HubIcons.Warning, null, tint = c.bad, modifier = Modifier.size(32.dp))
        Text(stringResource(text), style = MaterialTheme.typography.titleMedium, color = c.text, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 300.dp))
        PillButton(stringResource(R.string.link_retry), onRetry, small = true)
    }
}
