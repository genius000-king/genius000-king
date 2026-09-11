package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.core.provision.InstallStep
import io.nawah.linux.ui.components.LogPane
import io.nawah.linux.ui.state.*
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstallScreen(
    state: InstallUiState,
    onCancel: () -> Unit,
    onCopyLog: () -> Unit,
    onDone: () -> Unit,
) {
    Scaffold(
        topBar = { TopAppBar(title = { Text(state.machineName.ifBlank { stringResource(R.string.install_title) }) }) },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Row(Modifier.fillMaxWidth().padding(Spacing.md),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    when {
                        state.done -> Button(
                            onClick = onDone,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text(stringResource(R.string.action_done)) }

                        state.failed -> {
                            OutlinedButton(
                                onClick = onCopyLog,
                                modifier = Modifier.weight(1f).height(48.dp),
                            ) { Text(stringResource(R.string.action_copy_log)) }
                            Button(
                                onClick = onDone,
                                modifier = Modifier.weight(1f).height(48.dp),
                            ) { Text(stringResource(R.string.action_close)) }
                        }

                        else -> OutlinedButton(
                            onClick = onCancel,
                            enabled = !state.cancelling,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) { Text(stringResource(R.string.action_cancel)) }
                    }
                }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(Spacing.md)) {
            LinearProgressIndicator(
                progress = { state.fraction ?: 0f },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(Spacing.md))

            state.steps.forEach { step ->
                StepRow(step, state.statusOf(step))
            }

            state.failure?.let { failure ->
                Spacer(Modifier.height(Spacing.md))
                Surface(
                    color = NawahTheme.status.badContainer,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(Spacing.md)) {
                        Text(failure.stepLabel, style = MaterialTheme.typography.titleSmall,
                            color = NawahTheme.status.bad)
                        Text(failure.message, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Spacer(Modifier.height(Spacing.md))
            LogPane(state.logText, Modifier.fillMaxWidth().weight(1f))
        }
    }
}

@Composable
private fun StepRow(step: InstallStepUi, status: StepStatus) {
    val colors = NawahTheme.status
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(22.dp), Alignment.Center) {
            when (status) {
                StepStatus.DONE -> Icon(Icons.Default.Check, null, tint = colors.good)
                StepStatus.CURRENT -> CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                StepStatus.FAILED -> Icon(Icons.Default.Close, null, tint = colors.bad)
                StepStatus.PENDING -> Text("•", color = MaterialTheme.colorScheme.outline)
            }
        }
        Spacer(Modifier.width(Spacing.sm))
        Text(
            step.label,
            style = MaterialTheme.typography.bodyMedium,
            color = when (status) {
                StepStatus.PENDING -> MaterialTheme.colorScheme.onSurfaceVariant
                StepStatus.FAILED -> colors.bad
                else -> MaterialTheme.colorScheme.onSurface
            },
        )
    }
}

@Preview(name = "Install · running")
@Composable
private fun PreviewInstall() = NawahTheme {
    InstallScreen(
        InstallUiState(
            machineName = "Desktop",
            steps = InstallStep.ordered.map { it.toUi() },
            currentOrder = 5,
            fraction = 0.55f,
            log = listOf(
                "Get:1 http://deb.debian.org/debian trixie InRelease",
                "Unpacking xfce4-session (4.20.0-1) ...",
                "Setting up xfwm4 (4.20.0-1) ...",
            ),
        ),
        {}, {}, {},
    )
}

@Preview(name = "Install · failed")
@Composable
private fun PreviewInstallFailed() = NawahTheme {
    InstallScreen(
        InstallUiState(
            machineName = "Desktop",
            steps = InstallStep.ordered.map { it.toUi() },
            currentOrder = 3,
            failure = InstallFailure(
                "Unpacking filesystem",
                "tar: write error: No space left on device",
                "tar: write error: No space left on device",
            ),
        ),
        {}, {}, {},
    )
}
