package com.genius.imlaq.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.genius.imlaq.R
import com.genius.imlaq.designsystem.GhostButton
import com.genius.imlaq.designsystem.IconCircle
import com.genius.imlaq.designsystem.Imlaq
import com.genius.imlaq.designsystem.ImlaqDimens
import com.genius.imlaq.designsystem.ImlaqIcons
import com.genius.imlaq.designsystem.PillButton
import com.genius.imlaq.designsystem.StatusDot
import com.genius.imlaq.designsystem.glass
import com.genius.imlaq.session.SessionState
import java.util.Locale

interface ChatActions {
    fun send(text: String)
    fun stop()
    fun newChat()
    fun goToModels()
}

@Composable
fun ChatScreen(
    state: ChatUiState,
    input: String,
    onInput: (String) -> Unit,
    actions: ChatActions,
    modifier: Modifier = Modifier,
) {
    when (val s = state.session) {
        SessionState.Idle -> Notice(
            title = stringResource(R.string.chat_no_model_title),
            body = stringResource(R.string.chat_no_model_body),
            action = stringResource(R.string.chat_go_models) to actions::goToModels,
            modifier = modifier,
        )
        is SessionState.Loading -> Notice(
            title = stringResource(R.string.chat_loading_title, s.model.name),
            body = stringResource(R.string.chat_loading_body),
            modifier = modifier,
        )
        is SessionState.Failed -> Notice(
            title = stringResource(R.string.chat_failed_title, s.model.name),
            body = s.message,
            action = stringResource(R.string.chat_go_models) to actions::goToModels,
            modifier = modifier,
        )
        is SessionState.Ready -> Conversation(s.model.name, state, input, onInput, actions, modifier)
    }
}

@Composable
private fun Conversation(
    modelName: String,
    state: ChatUiState,
    input: String,
    onInput: (String) -> Unit,
    actions: ChatActions,
    modifier: Modifier,
) {
    val c = Imlaq.colors
    val list = rememberLazyListState()
    val lastText = state.messages.lastOrNull()?.text
    LaunchedEffect(state.messages.size, lastText?.length) {
        if (state.messages.isNotEmpty()) list.animateScrollToItem(state.messages.lastIndex)
    }

    Box(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                StatusDot(modelName, c.ok, Modifier.weight(1f))
                if (state.messages.isNotEmpty()) {
                    GhostButton(stringResource(R.string.chat_new), onClick = actions::newChat, icon = ImlaqIcons.Plus)
                }
            }
            if (state.messages.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text(
                        stringResource(R.string.chat_empty_hint, modelName),
                        style = MaterialTheme.typography.bodyLarge,
                        color = c.faint,
                    )
                }
            } else {
                LazyColumn(
                    Modifier.weight(1f).fillMaxWidth(),
                    state = list,
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    items(state.messages, key = { it.id }) { m ->
                        if (m.fromUser) UserBubble(m.text)
                        else Reply(m, streaming = state.generating && m.id == state.messages.last().id)
                    }
                }
            }
        }
        Composer(
            input = input,
            onInput = onInput,
            generating = state.generating,
            onSend = { actions.send(input); onInput("") },
            onStop = actions::stop,
            modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = 12.dp, vertical = 12.dp),
        )
    }
}

/** Your message: a solid bubble on the end side, its tail corner tucked toward the edge. */
@Composable
private fun UserBubble(text: String) {
    val c = Imlaq.colors
    val r = ImlaqDimens.cardRadius
    val shape = RoundedCornerShape(topStart = r, topEnd = r, bottomEnd = ImlaqDimens.bubbleTail, bottomStart = r)
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Text(
            text,
            style = MaterialTheme.typography.bodyLarge,
            color = c.onAccent,
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(shape)
                .background(c.accent, shape)
                .padding(horizontal = 14.dp, vertical = 9.dp),
        )
    }
}

/** The model's reply: open text, no bubble — easier to read when it runs long. */
@Composable
private fun Reply(m: ChatMessage, streaming: Boolean) {
    val c = Imlaq.colors
    Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
        if (m.text.isNotEmpty()) {
            StreamingText(m.text, streaming)
        } else if (m.thinking || streaming) {
            ThinkingIndicator()
        }
        when {
            m.error != null -> Text(stringResource(R.string.chat_error, m.error), style = MaterialTheme.typography.bodySmall, color = c.bad)
            m.tokensPerSecond != null -> Text(
                stringResource(R.string.chat_speed, String.format(Locale.US, "%.1f", m.tokensPerSecond)),
                style = MaterialTheme.typography.labelSmall,
                color = c.faint,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

/** The floating glass capsule you write in, with the send (or stop) button inside it. */
@Composable
private fun Composer(
    input: String,
    onInput: (String) -> Unit,
    generating: Boolean,
    onSend: () -> Unit,
    onStop: () -> Unit,
    modifier: Modifier,
) {
    val c = Imlaq.colors
    Row(
        modifier
            .fillMaxWidth()
            .glass(RoundedCornerShape(26.dp), blur = ImlaqDimens.barBlur, strong = true)
            .padding(start = 18.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicTextField(
            value = input,
            onValueChange = onInput,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.text),
            cursorBrush = SolidColor(c.text),
            maxLines = 5,
            modifier = Modifier.weight(1f).heightIn(min = 24.dp),
            decorationBox = { field ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (input.isEmpty()) {
                        Text(stringResource(R.string.chat_placeholder), style = MaterialTheme.typography.bodyLarge, color = c.faint)
                    }
                    field()
                }
            },
        )
        Spacer(Modifier.width(8.dp))
        if (generating) {
            IconCircle(ImlaqIcons.Stop, stringResource(R.string.chat_stop), onClick = onStop, filled = true)
        } else {
            IconCircle(ImlaqIcons.ArrowUp, stringResource(R.string.chat_send), onClick = onSend, filled = true, enabled = input.isNotBlank())
        }
    }
}

/** A centred message for the states before a conversation can start. */
@Composable
private fun Notice(title: String, body: String, modifier: Modifier, action: Pair<String, () -> Unit>? = null) {
    val c = Imlaq.colors
    Column(
        modifier.fillMaxSize().padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = c.text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = c.muted, textAlign = TextAlign.Center)
        if (action != null) {
            Spacer(Modifier.height(24.dp))
            PillButton(action.first, onClick = action.second)
        }
    }
}
