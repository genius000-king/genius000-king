package com.genius.tvhub.feature.tv.launcher

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.CardShape
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.ProgressTrack
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.designsystem.tvFocus

/** The extensions row: each widget is a small glass card the user chose in Interface settings. */
@Composable
fun WidgetsRow(state: LauncherState, actions: LauncherActions, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.Bottom) {
        state.appearance.widgets.forEach { kind ->
            when (kind) {
                WidgetKind.PHONE -> PhoneWidget(state.phoneName)
                WidgetKind.DEVICE -> if (state.ramFraction != null) DeviceWidget(state.ramFraction, state.storageFraction)
                WidgetKind.SHORTCUTS -> state.shortcuts.take(3).forEach { s -> ShortcutChip(s) { actions.run(s) } }
            }
        }
    }
}

@Composable
private fun WidgetCard(content: @Composable () -> Unit) {
    Column(Modifier.width(210.dp).glass(CardShape).padding(horizontal = 16.dp, vertical = 14.dp)) { content() }
}

@Composable
private fun PhoneWidget(name: String?) = WidgetCard {
    val c = Imlaq.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(HubIcons.Devices, null, tint = if (name != null) c.ok else c.faint, modifier = Modifier.size(18.dp))
        Text(name ?: "—", style = MaterialTheme.typography.labelMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    Spacer(Modifier.height(6.dp))
    Text(if (name != null) stringResource(R.string.tv_phone_connected, "").trim() else "TV Hub", style = MaterialTheme.typography.bodySmall, color = c.muted)
}

@Composable
private fun DeviceWidget(ram: Float, storage: Float?) = WidgetCard {
    val c = Imlaq.colors
    Meter(HubIcons.Memory, "RAM", ram)
    if (storage != null) { Spacer(Modifier.height(10.dp)); Meter(HubIcons.Storage, "", storage) }
}

@Composable
private fun Meter(icon: ImageVector, label: String, fraction: Float) {
    val c = Imlaq.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, tint = c.muted, modifier = Modifier.size(15.dp))
        if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.labelSmall, color = c.muted)
        Spacer(Modifier.weight(1f))
        Text("${(fraction * 100).toInt()}%", style = MaterialTheme.typography.labelSmall, color = c.text)
    }
    Spacer(Modifier.height(6.dp))
    ProgressTrack(fraction)
}

@Composable
private fun ShortcutChip(shortcut: HomeShortcut, onClick: () -> Unit) {
    val c = Imlaq.colors
    Row(
        Modifier.tvFocus(PillShape).glass(PillShape, strong = true).clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            when (shortcut.action) {
                is ShortcutAction.OpenUrl -> HubIcons.Link
                is ShortcutAction.LaunchApp -> HubIcons.Bolt
                ShortcutAction.TogglePointer -> HubIcons.Cursor
                ShortcutAction.OpenSettings -> com.genius.tvhub.core.designsystem.ImlaqIcons.Settings
            },
            null, tint = c.text, modifier = Modifier.size(16.dp),
        )
        Text(shortcut.label, style = MaterialTheme.typography.labelMedium, color = c.text, maxLines = 1)
    }
}
