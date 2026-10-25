package com.genius.tvhub.feature.phone.remote

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.ActionTile
import com.genius.tvhub.core.designsystem.GhostButton
import com.genius.tvhub.core.designsystem.GlassEntrance
import com.genius.tvhub.core.designsystem.GlassLayer
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.LocalBackdrop
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.glass

private data class DeckEntry(val destination: Destination, val icon: ImageVector, val label: Int)

private val ENTRIES = listOf(
    DeckEntry(Destination.SCREEN, HubIcons.Tv, R.string.deck_screen),
    DeckEntry(Destination.MOUSE, HubIcons.Mouse, R.string.deck_mouse),
    DeckEntry(Destination.KEYBOARD, HubIcons.Keyboard, R.string.deck_keyboard),
    DeckEntry(Destination.DEVICE, HubIcons.Pulse, R.string.deck_device),
    DeckEntry(Destination.APPS, HubIcons.Apps, R.string.deck_apps),
    DeckEntry(Destination.FILES, HubIcons.Folder, R.string.deck_files),
    DeckEntry(Destination.SERVICES, HubIcons.Server, R.string.deck_services),
)

/**
 * Everything beyond the remote, in one sheet that rises from the bottom (the page below blurs).
 * Tiles arrive one after another on a spring, so the eye follows them in reading order.
 */
@Composable
fun DeckSheet(onOpen: (Destination) -> Unit, onDismiss: () -> Unit) {
    GlassLayer(onDismiss, GlassEntrance.SHEET) {
        CompositionLocalProvider(LocalBackdrop provides null) {
            Column(
                Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(12.dp)
                    .widthIn(max = 560.dp).fillMaxWidth()
                    .glass(RoundedCornerShape(28.dp), strong = true).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally).width(36.dp).height(4.dp).clip(PillShape).background(Imlaq.colors.line))
                ENTRIES.chunked(4).forEachIndexed { row, entries ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        entries.forEachIndexed { col, e ->
                            StaggeredTile(index = row * 4 + col, modifier = Modifier.weight(1f)) {
                                ActionTile(e.icon, stringResource(e.label), { onOpen(e.destination) }, Modifier.fillMaxWidth())
                            }
                        }
                        repeat(4 - entries.size) { Box(Modifier.weight(1f)) }
                    }
                }
                GhostButton(stringResource(R.string.deck_settings), { onOpen(Destination.SETTINGS) }, icon = ImlaqIcons.Settings, modifier = Modifier.align(Alignment.CenterHorizontally))
            }
        }
    }
}

@Composable
private fun StaggeredTile(index: Int, modifier: Modifier, content: @Composable () -> Unit) {
    val p = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(30L * index)
        p.animateTo(1f, spring(dampingRatio = 0.7f, stiffness = 380f))
    }
    Box(modifier.graphicsLayer { alpha = p.value; translationY = (1f - p.value) * 24.dp.toPx(); scaleX = 0.92f + 0.08f * p.value; scaleY = scaleX }) { content() }
}
