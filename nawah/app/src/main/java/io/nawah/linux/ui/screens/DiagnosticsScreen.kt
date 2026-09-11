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
import io.nawah.linux.ui.components.SectionHeader
import io.nawah.linux.ui.components.SignalRow
import io.nawah.linux.ui.state.DeviceFacts
import io.nawah.linux.ui.state.DiagnosticsUiState
import io.nawah.linux.ui.state.ProbeStatus
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.formatBytes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticsScreen(
    state: DiagnosticsUiState,
    onBack: () -> Unit,
    onRunProbe: () -> Unit,
    onExport: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.diagnostics_title)) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(Spacing.md),
        ) {
            SectionHeader(stringResource(R.string.diagnostics_device))
            SignalRow(stringResource(R.string.label_abi), state.facts.abi, Compatibility.GOOD)
            SignalRow(stringResource(R.string.label_memory),
                formatBytes(state.facts.totalRamBytes), Compatibility.GOOD)
            SignalRow(stringResource(R.string.label_free_space),
                formatBytes(state.facts.availableStorageBytes), Compatibility.GOOD)
            SignalRow(stringResource(R.string.label_cores),
                state.facts.cpuCores.toString(), Compatibility.GOOD)
            SignalRow(stringResource(R.string.label_api),
                state.facts.apiLevel.toString(), Compatibility.GOOD)

            SectionHeader(stringResource(R.string.diagnostics_probe))
            Text(
                stringResource(R.string.diagnostics_probe_help),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(Spacing.sm))
            ProbeResultRow(state)
            Spacer(Modifier.height(Spacing.sm))
            Button(
                onClick = onRunProbe,
                enabled = state.probe != ProbeStatus.RUNNING,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) { Text(stringResource(R.string.action_run_probe)) }

            SectionHeader(stringResource(R.string.diagnostics_export))
            Text(
                stringResource(R.string.diagnostics_export_help),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(Spacing.sm))
            OutlinedButton(
                onClick = onExport,
                enabled = !state.exporting,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) { Text(stringResource(R.string.action_export_diagnostics)) }
        }
    }
}

@Composable
private fun ProbeResultRow(state: DiagnosticsUiState) {
    val colors = NawahTheme.status
    val (text, color) = when (state.probe) {
        ProbeStatus.UNKNOWN -> stringResource(R.string.probe_unknown) to
            MaterialTheme.colorScheme.onSurfaceVariant
        ProbeStatus.RUNNING -> stringResource(R.string.probe_running) to
            MaterialTheme.colorScheme.onSurfaceVariant
        ProbeStatus.PASSED -> stringResource(R.string.probe_passed) to colors.good
        ProbeStatus.FAILED -> stringResource(R.string.probe_failed) to colors.bad
    }
    Column {
        Text(text, style = MaterialTheme.typography.titleSmall, color = color)
        state.probeDetail?.let {
            Text(it, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Preview(name = "Diagnostics")
@Composable
private fun PreviewDiagnostics() = NawahTheme {
    DiagnosticsScreen(
        DiagnosticsUiState(
            facts = DeviceFacts("arm64-v8a", 6L * 1024 * 1024 * 1024,
                22L * 1024 * 1024 * 1024, 8, 34),
            probe = ProbeStatus.PASSED,
        ),
        {}, {}, {},
    )
}
