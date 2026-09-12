package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.ui.components.LogPane
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing

/**
 * What the Linux session said.
 *
 * This screen exists because the X display can only ever show a black
 * rectangle when something goes wrong on the guest side. The session script
 * prints a preflight and a running commentary; this is where the user reads it
 * instead of guessing.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionLogScreen(
    machineName: String,
    lines: List<String>,
    running: Boolean,
    onBack: () -> Unit,
    onCopy: () -> Unit,
    onOpenDisplay: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.session_log_title, machineName)) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Row(
                    Modifier.fillMaxWidth().padding(Spacing.md),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    OutlinedButton(
                        onClick = onCopy,
                        modifier = Modifier.weight(1f).height(48.dp),
                    ) { Text(stringResource(R.string.action_copy_log)) }
                    Button(
                        onClick = onOpenDisplay,
                        enabled = running,
                        modifier = Modifier.weight(1f).height(48.dp),
                    ) { Text(stringResource(R.string.action_open_display)) }
                }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(Spacing.md)) {
            Text(
                stringResource(
                    if (running) R.string.session_running else R.string.session_stopped,
                ),
                style = MaterialTheme.typography.bodySmall,
                color = if (running) NawahTheme.status.good else NawahTheme.status.bad,
            )
            Spacer(Modifier.height(Spacing.sm))
            LogPane(lines.joinToString("\n"), Modifier.fillMaxWidth().weight(1f))
        }
    }
}

@Preview(name = "Session log")
@Composable
private fun PreviewSessionLog() = NawahTheme {
    SessionLogScreen(
        machineName = "Linux",
        lines = listOf(
            "nawah: starting session at 10:42:11",
            "nawah: starting the display bridge",
            "nawah: /system/bin/app_process is not visible in this container.",
            "nawah: preflight failed, not starting X",
        ),
        running = false,
        onBack = {}, onCopy = {}, onOpenDisplay = {},
    )
}
