package com.genius.tvhub.feature.phone.remote

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.glass
import kotlinx.coroutines.delay

/** A short glass note under the status capsule; leaves by itself. */
@Composable
internal fun NoticePill(notice: RemoteNotice?, onShown: () -> Unit) {
    var last by remember { mutableStateOf<RemoteNotice?>(null) }
    if (notice != null) last = notice
    LaunchedEffect(notice) { if (notice != null) { delay(3_500); onShown() } }
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.fillMaxSize().statusBarsPadding().padding(top = 64.dp, start = 24.dp, end = 24.dp), contentAlignment = Alignment.TopCenter) {
        AnimatedVisibility(notice != null, enter = slideInVertically { -it } + fadeIn(), exit = slideOutVertically { -it } + fadeOut()) {
            val text = when (val n = last) {
                RemoteNotice.NeedsAccessibility -> stringResource(R.string.notice_accessibility)
                RemoteNotice.Denied -> stringResource(R.string.notice_denied)
                is RemoteNotice.Text -> n.text
                null -> ""
            }
            Text(
                text, style = MaterialTheme.typography.bodyMedium, color = Imlaq.colors.text, textAlign = TextAlign.Center,
                modifier = Modifier.glass(shape).padding(horizontal = 18.dp, vertical = 12.dp),
            )
        }
    }
}
