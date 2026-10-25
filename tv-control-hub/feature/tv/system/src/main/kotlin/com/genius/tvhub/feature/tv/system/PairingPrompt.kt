package com.genius.tvhub.feature.tv.system

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.genius.tvhub.core.designsystem.CardShape
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.designsystem.tvFocus

/**
 * Shown over whatever is on the TV when a new phone asks to pair. "Allow" has focus: one OK and
 * the phone is paired for good. The code matches the phone's screen (a man-in-the-middle would
 * change it).
 */
@Composable
fun PairingPrompt(phoneName: String, code: String, onAllow: () -> Unit, onDeny: () -> Unit) {
    val c = Imlaq.colors
    val allow = remember { FocusRequester() }
    val enter = remember { Animatable(0f) }
    LaunchedEffect(Unit) { enter.animateTo(1f, spring(dampingRatio = 0.75f, stiffness = 300f)) }
    Box(Modifier.fillMaxSize().background(c.background.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
        Column(
            Modifier.graphicsLayer { alpha = enter.value; scaleX = 0.94f + 0.06f * enter.value; scaleY = scaleX }
                .width(560.dp).glass(CardShape, strong = true).padding(36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.size(64.dp).glass(androidx.compose.foundation.shape.CircleShape), contentAlignment = Alignment.Center) {
                Icon(ImlaqIcons.Phone, null, tint = c.text, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.pair_title, phoneName), style = MaterialTheme.typography.titleLarge, color = c.text)
            Spacer(Modifier.height(22.dp))
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    code.forEachIndexed { i, d ->
                        if (i == 3) Spacer(Modifier.width(12.dp))
                        Box(Modifier.size(width = 46.dp, height = 60.dp).glass(RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                            Text(d.toString(), fontSize = 30.sp, style = MaterialTheme.typography.headlineMedium, color = c.text)
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.pair_body), style = MaterialTheme.typography.bodyMedium, color = c.muted)
            Spacer(Modifier.height(28.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(
                    Modifier.focusRequester(allow).tvFocus(PillShape).background(c.accent, PillShape).clickable(onClick = onAllow).padding(horizontal = 40.dp, vertical = 14.dp),
                ) { Text(stringResource(R.string.pair_allow), style = MaterialTheme.typography.labelLarge, color = c.onAccent) }
                Box(
                    Modifier.tvFocus(PillShape).glass(PillShape).clickable(onClick = onDeny).padding(horizontal = 32.dp, vertical = 14.dp),
                ) { Text(stringResource(R.string.pair_deny), style = MaterialTheme.typography.labelLarge, color = c.text) }
            }
        }
    }
    LaunchedEffect(Unit) { runCatching { allow.requestFocus() } }
}
