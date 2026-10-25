package com.genius.tvhub.feature.tv.system

import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.CardShape
import com.genius.tvhub.core.designsystem.EmptyState
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.KeyValueRow
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.StatusDot
import com.genius.tvhub.core.designsystem.ToggleRow
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.designsystem.tvFocus
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.ServiceState

/** A toggle that the remote can reach: focus ring + the shared ToggleRow. */
@Composable
private fun TvToggle(title: String, checked: Boolean, subtitle: String? = null, onChange: (Boolean) -> Unit) {
    ToggleRow(title, checked, onChange, Modifier.tvFocus(CardShape), subtitle = subtitle)
}

/** A row of choices, one selected; each is a focusable pill. */
@Composable
private fun Choices(title: String, options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    val c = Imlaq.colors
    Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = c.text)
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            options.forEachIndexed { i, label ->
                val on = i == selected
                Box(
                    Modifier.tvFocus(PillShape)
                        .then(if (on) Modifier.background(c.accent, PillShape) else Modifier.glass(PillShape))
                        .clickable { onSelect(i) }
                        .padding(horizontal = 18.dp, vertical = 9.dp),
                ) { Text(label, style = MaterialTheme.typography.labelMedium, color = if (on) c.onAccent else c.text) }
            }
        }
    }
}

private val GLOW_STEPS = listOf(0f, 0.4f, 0.7f, 1f)

@Composable
internal fun InterfaceSection(s: HubSettings, a: SystemActions) {
    SectionTitle(stringResource(R.string.sys_interface))
    val glowIndex = GLOW_STEPS.indices.minBy { kotlin.math.abs(GLOW_STEPS[it] - s.glow) }
    Choices(
        stringResource(R.string.sys_glow),
        listOf(stringResource(R.string.sys_glow_off), stringResource(R.string.sys_glow_soft), stringResource(R.string.sys_glow_medium), stringResource(R.string.sys_glow_strong)),
        glowIndex,
    ) { i -> a.update { it.copy(glow = GLOW_STEPS[i]) } }
    TvToggle(stringResource(R.string.sys_motion), s.motion, stringResource(R.string.sys_motion_body)) { v -> a.update { it.copy(motion = v) } }
    TvToggle(stringResource(R.string.sys_frames), s.iconFrames, stringResource(R.string.sys_frames_body)) { v -> a.update { it.copy(iconFrames = v) } }
    TvToggle(stringResource(R.string.sys_big_icons), s.largeIcons) { v -> a.update { it.copy(largeIcons = v) } }
    TvToggle(stringResource(R.string.sys_labels), s.showLabels) { v -> a.update { it.copy(showLabels = v) } }
    Gap()
    TvToggle(stringResource(R.string.sys_widget_phone), s.widgetPhone) { v -> a.update { it.copy(widgetPhone = v) } }
    TvToggle(stringResource(R.string.sys_widget_device), s.widgetDevice) { v -> a.update { it.copy(widgetDevice = v) } }
    TvToggle(stringResource(R.string.sys_widget_shortcuts), s.widgetShortcuts) { v -> a.update { it.copy(widgetShortcuts = v) } }
}

@Composable
internal fun PhonesSection(state: SystemState, a: SystemActions) {
    SectionTitle(stringResource(R.string.sys_phones))
    if (state.phones.isEmpty()) {
        EmptyState(HubIcons.Devices, stringResource(R.string.sys_no_phones), stringResource(R.string.sys_no_phones_body))
    }
    state.phones.forEach { p ->
        Column(Modifier.fillMaxWidth().glass(CardShape, strong = true).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(com.genius.tvhub.core.designsystem.ImlaqIcons.Phone, null, tint = Imlaq.colors.text, modifier = Modifier.size(20.dp))
                Column(Modifier.weight(1f)) {
                    Text(p.name, style = MaterialTheme.typography.titleMedium, color = Imlaq.colors.text)
                    Text(p.model, style = MaterialTheme.typography.bodySmall, color = Imlaq.colors.muted)
                }
                if (p.connected) StatusDot(stringResource(R.string.sys_connected_now), Imlaq.colors.ok)
            }
            GRANTS.forEach { (g, label) ->
                TvToggle(stringResource(label), g in p.grants) { on -> a.setGrant(p.id, g, on) }
            }
            Row(Modifier.padding(top = 6.dp)) {
                Box(Modifier.tvFocus(PillShape).glass(PillShape).clickable { a.revoke(p.id) }.padding(horizontal = 18.dp, vertical = 10.dp)) {
                    Text(stringResource(R.string.sys_revoke), style = MaterialTheme.typography.labelMedium, color = Imlaq.colors.bad)
                }
            }
        }
    }
    Gap()
    TvToggle(stringResource(R.string.sys_auto_approve), state.settings.autoApproveNew, stringResource(R.string.sys_auto_approve_body)) { v -> a.update { it.copy(autoApproveNew = v) } }
}

private val GRANTS = listOf(
    Grant.SCREEN to R.string.sys_grant_screen,
    Grant.INPUT to R.string.sys_grant_input,
    Grant.SYSTEM_INFO to R.string.sys_grant_info,
    Grant.FILES_READ to R.string.sys_grant_files_read,
    Grant.FILES_WRITE to R.string.sys_grant_files_write,
    Grant.APPS to R.string.sys_grant_apps,
    Grant.SHELL to R.string.sys_grant_shell,
    Grant.SERVICES to R.string.sys_grant_services,
)

@Composable
internal fun SetupSection(items: List<SetupItem>, a: SystemActions) {
    val c = Imlaq.colors
    SectionTitle(stringResource(R.string.sys_setup))
    if (items.all { it.done }) {
        EmptyState(HubIcons.Check, stringResource(R.string.sys_setup_done), "")
        return
    }
    items.forEach { item ->
        val (title, body) = when (item.kind) {
            SetupKind.ACCESSIBILITY -> R.string.sys_check_accessibility to R.string.sys_check_accessibility_body
            SetupKind.INSTALL -> R.string.sys_check_install to R.string.sys_check_install_body
            SetupKind.FILES -> R.string.sys_check_files to R.string.sys_check_files_body
            SetupKind.HOME -> R.string.sys_check_home to R.string.sys_check_home_body
        }
        Row(
            Modifier.fillMaxWidth().tvFocus(CardShape).glass(CardShape).clickable(enabled = !item.done) { a.openSetup(item.kind) }.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(Modifier.size(28.dp).background(if (item.done) c.ok.copy(alpha = 0.18f) else c.warn.copy(alpha = 0.18f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(if (item.done) HubIcons.Check else HubIcons.Warning, null, tint = if (item.done) c.ok else c.warn, modifier = Modifier.size(15.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(stringResource(title), style = MaterialTheme.typography.titleMedium, color = c.text)
                Text(stringResource(body), style = MaterialTheme.typography.bodySmall, color = c.muted)
            }
            if (!item.done) Text(stringResource(R.string.sys_open), style = MaterialTheme.typography.labelMedium, color = c.text)
        }
    }
    Text(stringResource(R.string.sys_adb_hint), style = MaterialTheme.typography.bodySmall, color = c.faint, modifier = Modifier.padding(top = 8.dp, start = 4.dp))
}

@Composable
internal fun SystemSection(s: HubSettings, a: SystemActions) {
    SectionTitle(stringResource(R.string.sys_system))
    TvToggle(stringResource(R.string.sys_take_home), s.launcherTakesHome, stringResource(R.string.sys_take_home_body)) { v -> a.update { it.copy(launcherTakesHome = v) } }
    TvToggle(stringResource(R.string.sys_boot), s.startOnBoot) { v -> a.update { it.copy(startOnBoot = v) } }
    TvToggle(stringResource(R.string.sys_auto_mouse), s.autoMouseForPhoneApps, stringResource(R.string.sys_auto_mouse_body)) { v -> a.update { it.copy(autoMouseForPhoneApps = v) } }
    TvToggle(stringResource(R.string.sys_remote_mouse), s.remoteMouseLongPress, stringResource(R.string.sys_remote_mouse_body)) { v -> a.update { it.copy(remoteMouseLongPress = v) } }
    Choices(stringResource(R.string.sys_language), listOf(stringResource(R.string.sys_lang_system), "العربية", "English"), s.language.ordinal) { i -> a.setLanguage(AppLanguage.entries[i]) }
}

@Composable
internal fun ServicesSection(services: List<ServiceRow>) {
    val c = Imlaq.colors
    SectionTitle(stringResource(R.string.sys_services))
    if (services.isEmpty()) {
        EmptyState(HubIcons.Server, stringResource(R.string.sys_no_services), stringResource(R.string.sys_no_services_body))
        return
    }
    services.forEach { s ->
        Row(Modifier.fillMaxWidth().glass(CardShape).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(s.name, style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            StatusDot(s.state.name.lowercase(), when (s.state) { ServiceState.RUNNING -> c.ok; ServiceState.CRASHED -> c.bad; else -> c.faint })
        }
    }
}

@Composable
internal fun AboutSection(state: SystemState) {
    SectionTitle(stringResource(R.string.sys_about))
    KeyValueRow(stringResource(R.string.sys_version), state.version)
    KeyValueRow(stringResource(R.string.sys_fingerprint), state.fingerprint)
    KeyValueRow(stringResource(R.string.sys_address), state.address)
}

