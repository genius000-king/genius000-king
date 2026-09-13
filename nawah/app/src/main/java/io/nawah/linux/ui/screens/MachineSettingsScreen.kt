package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.core.model.Compatibility
import io.nawah.linux.core.model.MachinePermissions
import io.nawah.linux.core.model.MachineState
import io.nawah.linux.ui.components.*
import io.nawah.linux.ui.state.MachineSettingsUiState
import io.nawah.linux.ui.state.NameError
import io.nawah.linux.ui.state.ResolutionOption
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.formatBytes

data class MachineSettingsActions(
    val onBack: () -> Unit = {},
    val onName: (String) -> Unit = {},
    val onSaveName: () -> Unit = {},
    val onPermissions: (MachinePermissions) -> Unit = {},
    val onResolution: (ResolutionOption) -> Unit = {},
    val onRepair: () -> Unit = {},
    val onRequestDelete: () -> Unit = {},
    val onConfirmDelete: () -> Unit = {},
    val onDismissDelete: () -> Unit = {},
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MachineSettingsScreen(state: MachineSettingsUiState, actions: MachineSettingsActions) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.name.ifBlank { stringResource(R.string.settings_title) }) },
                navigationIcon = {
                    TextButton(onClick = actions.onBack) {
                        Text(stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(Spacing.md),
        ) {
            OutlinedTextField(
                value = state.name,
                onValueChange = actions.onName,
                label = { Text(stringResource(R.string.label_machine_name)) },
                singleLine = true,
                isError = state.nameError != null,
                supportingText = state.nameError?.let { err -> { Text(stringResource(nameErr(err))) } },
                trailingIcon = {
                    TextButton(onClick = actions.onSaveName, enabled = state.canSaveName) {
                        Text(stringResource(R.string.action_save))
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )

            SectionHeader(stringResource(R.string.settings_system))
            SignalRow(stringResource(R.string.wizard_step_distro), state.distroName, Compatibility.GOOD)
            SignalRow(stringResource(R.string.wizard_step_desktop), state.desktopName, Compatibility.GOOD)
            SignalRow(
                stringResource(R.string.label_disk_usage),
                if (state.diskUsageBytes >= 0) formatBytes(state.diskUsageBytes)
                else stringResource(R.string.label_measuring),
                Compatibility.GOOD,
            )

            SectionHeader(stringResource(R.string.label_resolution))
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                state.resolutions.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                        row.forEach { res ->
                            FilterChip(
                                selected = res == state.selectedResolution,
                                onClick = { actions.onResolution(res) },
                                label = { Text(scaleLabel(res)) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }

            SectionHeader(stringResource(R.string.wizard_step_permissions))
            val p = state.permissions
            ExplainedSwitch(stringResource(R.string.perm_audio),
                stringResource(R.string.perm_audio_help), p.audioOut) {
                actions.onPermissions(p.copy(audioOut = it))
            }
            ExplainedSwitch(stringResource(R.string.perm_mic),
                stringResource(R.string.perm_mic_help), p.microphone) {
                actions.onPermissions(p.copy(microphone = it))
            }
            ExplainedSwitch(stringResource(R.string.perm_storage),
                stringResource(R.string.perm_storage_help), p.storage) {
                actions.onPermissions(p.copy(storage = it))
            }

            SectionHeader(stringResource(R.string.settings_maintenance))
            Text(
                stringResource(R.string.repair_bridge_help),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(Spacing.sm))
            OutlinedButton(
                onClick = actions.onRepair,
                enabled = !state.repairing,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text(
                    stringResource(
                        if (state.repairing) R.string.action_repairing else R.string.action_repair_bridge,
                    ),
                )
            }

            Spacer(Modifier.height(Spacing.md))
            Button(
                onClick = actions.onRequestDelete,
                enabled = !state.busy,
                colors = ButtonDefaults.buttonColors(
                    containerColor = NawahTheme.status.badContainer,
                    contentColor = NawahTheme.status.bad,
                ),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) { Text(stringResource(R.string.action_delete_system)) }
            Spacer(Modifier.height(Spacing.xl))
        }
    }

    if (state.showDeleteDialog) {
        AlertDialog(
            onDismissRequest = actions.onDismissDelete,
            title = { Text(stringResource(R.string.delete_title)) },
            text = { Text(stringResource(R.string.delete_body, state.name)) },
            confirmButton = {
                TextButton(onClick = actions.onConfirmDelete) {
                    Text(stringResource(R.string.action_delete))
                }
            },
            dismissButton = {
                TextButton(onClick = actions.onDismissDelete) {
                    Text(stringResource(R.string.action_cancel))
                }
            },
        )
    }
}

private fun nameErr(err: NameError) = when (err) {
    NameError.EMPTY -> R.string.name_error_empty
    NameError.TOO_LONG -> R.string.name_error_too_long
    NameError.DUPLICATE -> R.string.name_error_duplicate
    NameError.ILLEGAL_CHARS -> R.string.name_error_illegal
}

@Preview(name = "Machine settings")
@Composable
private fun PreviewSettings() = NawahTheme {
    MachineSettingsScreen(
        MachineSettingsUiState(
            machineId = "a", name = "Desktop",
            distroName = "Debian 13", desktopName = "XFCE 4",
            state = MachineState.READY, diskUsageBytes = 2_400_000_000,
        ),
        MachineSettingsActions(),
    )
}
