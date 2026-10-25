package com.genius.tvhub.feature.phone.remote

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.GlassField
import com.genius.tvhub.core.designsystem.GlassSheet
import com.genius.tvhub.core.designsystem.IconCircle
import com.genius.tvhub.core.designsystem.ImlaqIcons

/**
 * Opens by itself when the TV focuses a text field. What you type replaces the TV field's text
 * live; the phone keyboard's Enter key submits on the TV.
 */
@Composable
fun KeyboardSheet(text: String, onType: (String) -> Unit, onEnter: () -> Unit, onClose: () -> Unit) {
    val focus = remember { FocusRequester() }
    GlassSheet(stringResource(R.string.kb_title), onClose) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            GlassField(
                value = text,
                onValueChange = onType,
                placeholder = stringResource(R.string.kb_hint),
                modifier = Modifier.focusRequester(focus),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { onEnter() }),
                trailing = { IconCircle(ImlaqIcons.ArrowUp, stringResource(R.string.kb_enter), onEnter, filled = true) },
            )
        }
    }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
}
