package com.genius.tvhub.feature.phone.services

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.tvhub.core.common.formatDuration
import com.genius.tvhub.core.designsystem.CapsuleField
import com.genius.tvhub.core.designsystem.EmptyState
import com.genius.tvhub.core.designsystem.GlassCard
import com.genius.tvhub.core.designsystem.GlassDialog
import com.genius.tvhub.core.designsystem.GlassField
import com.genius.tvhub.core.designsystem.GlassSheet
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.HubPage
import com.genius.tvhub.core.designsystem.IconCircle
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.PillButton
import com.genius.tvhub.core.designsystem.PillSwitch
import com.genius.tvhub.core.designsystem.SegmentedTabs
import com.genius.tvhub.core.designsystem.StatusDot
import com.genius.tvhub.core.model.ServiceKind
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceState
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.protocol.ServiceEntry

/** One card per service, a big switch on each. Tap the card for its logs. */
@Composable
fun ServicesRoute(onBack: () -> Unit, onTerminal: () -> Unit, vm: ServicesViewModel = hiltViewModel()) {
    val list by vm.list.collectAsStateWithLifecycle()
    val logs by vm.logs.collectAsStateWithLifecycle()
    var adding by remember { mutableStateOf(false) }
    val c = Imlaq.colors
    HubPage(stringResource(R.string.svc_title), onBack, action = { IconCircle(ImlaqIcons.Plus, stringResource(R.string.svc_add), { adding = true }) }) {
        if (list.isEmpty()) EmptyState(HubIcons.Server, stringResource(R.string.svc_empty), stringResource(R.string.svc_empty_body), action = stringResource(R.string.svc_add), onAction = { adding = true })
        list.forEach { e -> ServiceCard(e, vm) }
        GlassCard(onClick = onTerminal) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                androidx.compose.material3.Icon(HubIcons.Terminal, null, tint = c.text)
                Column {
                    Text(stringResource(R.string.svc_terminal), style = MaterialTheme.typography.titleMedium, color = c.text)
                    Text(stringResource(R.string.svc_terminal_body), style = MaterialTheme.typography.bodySmall, color = c.muted)
                }
            }
        }
    }
    if (adding) AddServiceDialog({ adding = false }) { vm.save(it); adding = false }
    logs?.let { (name, lines) ->
        GlassSheet("${stringResource(R.string.svc_logs)} · $name", vm::closeLogs) {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                lines.forEach { Text(it, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = c.muted, style = MaterialTheme.typography.bodySmall.copy(textDirection = TextDirection.Ltr)) }
            }
        }
    }
}

@Composable
private fun ServiceCard(e: ServiceEntry, vm: ServicesViewModel) {
    val c = Imlaq.colors
    val running = e.status.state == ServiceState.RUNNING
    GlassCard(onClick = { vm.openLogs(e) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(e.spec.name, style = MaterialTheme.typography.titleMedium, color = c.text)
                StatusDot(
                    when (e.status.state) { ServiceState.RUNNING -> e.status.uptimeSeconds?.let { formatDuration(it * 1000) } ?: "running"; else -> e.status.state.name.lowercase() },
                    when (e.status.state) { ServiceState.RUNNING -> c.ok; ServiceState.CRASHED -> c.bad; else -> c.faint },
                )
            }
            PillSwitch(running, { vm.toggle(e, it) })
        }
    }
}

@Composable
private fun AddServiceDialog(onClose: () -> Unit, onSave: (ServiceSpec) -> Unit) {
    var name by remember { mutableStateOf("") }
    var id by remember { mutableStateOf("") }
    var folder by remember { mutableStateOf("~/") }
    var command by remember { mutableStateOf("") }
    var kind by remember { mutableIntStateOf(0) }
    GlassDialog(stringResource(R.string.svc_add), onClose, actions = {
        PillButton(stringResource(R.string.svc_save), {
            onSave(ServiceSpec(id.ifBlank { name.lowercase().replace(Regex("[^a-z0-9_-]"), "-").trim('-') }, name, ServiceKind.entries[kind], folder, command))
        }, small = true, enabled = name.isNotBlank())
    }) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SegmentedTabs(listOf("Node", "Python", "Custom"), kind, { kind = it })
            CapsuleField(stringResource(R.string.svc_name), name, { name = it })
            CapsuleField(stringResource(R.string.svc_folder), folder, { folder = it })
            CapsuleField(stringResource(R.string.svc_command), command, { command = it })
        }
    }
}

/** A command, its output. Two backends: the app's own limited shell, or Termux. */
@Composable
fun TerminalRoute(onBack: () -> Unit, vm: ServicesViewModel = hiltViewModel()) {
    val lines by vm.terminal.collectAsStateWithLifecycle()
    var backend by remember { mutableIntStateOf(0) }
    var command by remember { mutableStateOf("") }
    val c = Imlaq.colors
    HubPage(stringResource(R.string.svc_terminal), onBack) {
        SegmentedTabs(listOf(stringResource(R.string.term_app), stringResource(R.string.term_termux)), backend, { backend = it })
        if (backend == 1) {
            Text(stringResource(R.string.term_enable), style = MaterialTheme.typography.bodySmall, color = c.faint)
            Text("mkdir -p ~/.termux && echo 'allow-external-apps=true' >> ~/.termux/termux.properties", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = c.muted, style = MaterialTheme.typography.bodySmall.copy(textDirection = TextDirection.Ltr))
        }
        GlassField(
            command, { command = it }, stringResource(R.string.term_hint), leading = HubIcons.Terminal,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { vm.run(if (backend == 0) ShellBackend.SANDBOX else ShellBackend.TERMUX, command); command = "" }),
        )
        lines.asReversed().forEach { line ->
            Column(Modifier.fillMaxWidth().background(c.glass, androidx.compose.foundation.shape.RoundedCornerShape(16.dp)).padding(12.dp)) {
                Text("$ ${line.command}", fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = c.text, style = MaterialTheme.typography.bodySmall.copy(textDirection = TextDirection.Ltr))
                val r = line.result
                if (r == null) Text("…", color = c.faint)
                else {
                    if (r.stdout.isNotBlank()) Text(r.stdout.trimEnd(), fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = c.muted, style = MaterialTheme.typography.bodySmall.copy(textDirection = TextDirection.Ltr))
                    if (r.stderr.isNotBlank()) Text(r.stderr.trimEnd(), fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = c.bad, style = MaterialTheme.typography.bodySmall.copy(textDirection = TextDirection.Ltr))
                    Text("exit ${r.exitCode} · ${r.durationMillis} ms", fontSize = 11.sp, color = c.faint)
                }
            }
        }
    }
}

