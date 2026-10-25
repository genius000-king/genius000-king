package com.genius.tvhub.feature.phone.remote

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.GlassOrb
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.HubSurface
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.model.TvEndpoint

/** What the remote screen can ask for. One object keeps the composable's signature readable. */
interface RemoteActions {
    fun key(action: KeyAction)
    fun open(destination: Destination)
    fun connect(tv: TvEndpoint)
    fun retry()
    fun manualAddress()
    fun hintSeen()
}

/**
 * The phone's main screen. While connected it is a gesture surface with three orbs; before
 * that, the same surface shows the search, the approval code, or what went wrong. The TV's live
 * picture, blurred, can sit behind everything ([backdrop]).
 */
@Composable
fun RemoteScreen(
    state: LinkState,
    actions: RemoteActions,
    showHint: Boolean,
    modifier: Modifier = Modifier,
    backdrop: @Composable () -> Unit = {},
) {
    var deckOpen by rememberSaveable { mutableStateOf(false) }
    HubSurface(modifier) {
        backdrop()
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            StatusCapsule(state, onClick = { actions.open(Destination.DEVICE) }, modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 12.dp))
            Box(Modifier.weight(1f).fillMaxWidth()) {
                AnimatedContent(
                    targetState = state.stage(),
                    transitionSpec = { (fadeIn(tween(260)) + scaleIn(initialScale = 0.96f)) togetherWith fadeOut(tween(180)) },
                    label = "link-stage",
                ) { stage ->
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        when (stage) {
                            Stage.CONNECTED -> GesturePad(
                                onSwipe = { actions.key(it.toKey()) },
                                onTap = { actions.key(KeyAction.CENTER) },
                                onPinchOut = { actions.open(Destination.SCREEN) },
                            ) {
                                if (showHint) Hint(Modifier.align(Alignment.BottomCenter))
                            }
                            Stage.SEARCHING -> SearchingView(state as? LinkState.Searching ?: LinkState.Searching(), actions::connect, actions::manualAddress)
                            Stage.CONNECTING -> ConnectingView(state.tvName(), reconnecting = state is LinkState.Reconnecting)
                            Stage.APPROVAL -> ApprovalView((state as LinkState.AwaitingApproval).code)
                            Stage.FAILED -> FailedView((state as LinkState.Failed).failure, actions::retry)
                        }
                    }
                }
            }
            AnimatedVisibility(
                visible = state is LinkState.Connected,
                enter = slideInVertically { it } + fadeIn(),
                exit = slideOutVertically { it } + fadeOut(),
            ) {
                Row(Modifier.fillMaxWidth().padding(bottom = 20.dp, top = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    GlassOrb(ImlaqIcons.Back, stringResource(R.string.remote_back), { actions.key(KeyAction.BACK) })
                    GlassOrb(HubIcons.Home, stringResource(R.string.remote_home), { actions.key(KeyAction.HOME) }, size = 68.dp)
                    GlassOrb(HubIcons.Apps, stringResource(R.string.remote_more), { deckOpen = true })
                }
            }
        }
    }
    if (deckOpen) DeckSheet(onOpen = { deckOpen = false; actions.open(it) }, onDismiss = { deckOpen = false })
}

@Composable
private fun Hint(modifier: Modifier) {
    val c = Imlaq.colors
    Column(modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(R.string.remote_hint), style = MaterialTheme.typography.titleMedium, color = c.muted, textAlign = TextAlign.Center)
        Text(stringResource(R.string.remote_hint_more), style = MaterialTheme.typography.bodySmall, color = c.faint, textAlign = TextAlign.Center)
    }
}

private enum class Stage { SEARCHING, CONNECTING, APPROVAL, CONNECTED, FAILED }

private fun LinkState.stage() = when (this) {
    is LinkState.Searching -> Stage.SEARCHING
    is LinkState.Connecting, is LinkState.Reconnecting -> Stage.CONNECTING
    is LinkState.AwaitingApproval -> Stage.APPROVAL
    is LinkState.Connected -> Stage.CONNECTED
    is LinkState.Failed -> Stage.FAILED
}

private fun LinkState.tvName() = when (this) {
    is LinkState.Connecting -> tv.name
    is LinkState.Reconnecting -> tv.name
    is LinkState.AwaitingApproval -> tv.name
    is LinkState.Connected -> tv.name
    is LinkState.Failed -> tv?.name.orEmpty()
    is LinkState.Searching -> ""
}

internal fun Swipe.toKey() = when (this) {
    Swipe.UP -> KeyAction.UP
    Swipe.DOWN -> KeyAction.DOWN
    Swipe.LEFT -> KeyAction.LEFT
    Swipe.RIGHT -> KeyAction.RIGHT
}
