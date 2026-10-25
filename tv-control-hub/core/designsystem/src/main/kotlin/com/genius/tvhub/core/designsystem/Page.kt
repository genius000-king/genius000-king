package com.genius.tvhub.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

/**
 * A page of this app: no title bar. A round back glyph floats at the top, the title is the first
 * thing in the content, large, and scrolls away with it. At most one [action] sits opposite the
 * back glyph. [scroll] = false for pages that own their whole surface (screen, touchpad).
 */
@Composable
fun HubPage(
    title: String?,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    scroll: Boolean = true,
    action: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = Imlaq.colors
    ImlaqBackground(modifier) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) IconCircle(ImlaqIcons.Back, stringResource(R.string.ds_back), onBack)
                Spacer(Modifier.weight(1f))
                action?.invoke()
            }
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .then(if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier)
                    .padding(horizontal = 20.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (title != null) {
                    Text(title, style = MaterialTheme.typography.headlineMedium, color = c.text, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
                }
                content()
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

/** A full-bleed surface with the stone behind and nothing else: for the remote and the screen. */
@Composable
fun HubSurface(modifier: Modifier = Modifier, content: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit) {
    ImlaqBackground(modifier) { Box(Modifier.fillMaxSize(), content = content) }
}
