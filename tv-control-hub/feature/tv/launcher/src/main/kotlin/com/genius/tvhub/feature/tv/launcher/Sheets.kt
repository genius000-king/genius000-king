package com.genius.tvhub.feature.tv.launcher

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.CardShape
import com.genius.tvhub.core.designsystem.GlassSheet
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.designsystem.tvFocus

/** Long press on an app: four choices at most. */
@Composable
fun AppMenu(app: LauncherApp, inSpace: Boolean, actions: LauncherActions, onClose: () -> Unit) {
    val first = remember { FocusRequester() }
    GlassSheet(app.label, onClose) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SheetRow(ImlaqIcons.Play, stringResource(R.string.tv_open), Modifier.focusRequester(first)) { onClose(); actions.launch(app) }
            SheetRow(HubIcons.Star, stringResource(if (inSpace) R.string.tv_remove_from_space else R.string.tv_add_to_space)) { onClose(); actions.toggleSpace(app) }
            SheetRow(HubIcons.Info, stringResource(R.string.tv_app_info)) { onClose(); actions.appInfo(app) }
            SheetRow(ImlaqIcons.Trash, stringResource(R.string.tv_uninstall)) { onClose(); actions.uninstall(app) }
        }
    }
    LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
}

/** Three ways to put an app on the TV, each one sentence long. */
@Composable
fun AddAppSheet(actions: LauncherActions, onClose: () -> Unit) {
    val first = remember { FocusRequester() }
    GlassSheet(stringResource(R.string.tv_add_app), onClose) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SheetRow(ImlaqIcons.Phone, stringResource(R.string.tv_add_from_phone), Modifier.focusRequester(first), stringResource(R.string.tv_add_from_phone_body)) { onClose(); actions.addApp(AddSource.PHONE) }
            SheetRow(HubIcons.Folder, stringResource(R.string.tv_add_from_files), subtitle = stringResource(R.string.tv_add_from_files_body)) { onClose(); actions.addApp(AddSource.FILES) }
            SheetRow(HubIcons.Link, stringResource(R.string.tv_add_from_link), subtitle = stringResource(R.string.tv_add_from_link_body)) { onClose(); actions.addApp(AddSource.LINK) }
        }
    }
    LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
}

@Composable
private fun SheetRow(icon: ImageVector, title: String, modifier: Modifier = Modifier, subtitle: String? = null, onClick: () -> Unit) {
    val c = Imlaq.colors
    Row(
        modifier.fillMaxWidth().tvFocus(CardShape).glass(CardShape).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(Modifier.size(40.dp).glass(CircleShape, strong = true), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = c.text, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = c.text)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted)
        }
    }
}
