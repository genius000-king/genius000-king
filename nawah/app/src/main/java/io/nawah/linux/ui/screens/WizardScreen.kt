package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.core.model.*
import io.nawah.linux.ui.components.*
import io.nawah.linux.ui.state.*
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.formatBytes

/** Callbacks the wizard needs. Grouped so the screen signature stays readable. */
data class WizardActions(
    val onBack: () -> Unit = {},
    val onNext: () -> Unit = {},
    val onCancel: () -> Unit = {},
    val onDistro: (String) -> Unit = {},
    val onDesktop: (String) -> Unit = {},
    val onName: (String) -> Unit = {},
    val onProfile: (ResourceProfile) -> Unit = {},
    val onResolution: (ResolutionOption) -> Unit = {},
    val onPermissions: (MachinePermissions) -> Unit = {},
    val onInstall: () -> Unit = {},
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WizardScreen(state: WizardUiState, actions: WizardActions) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.wizard_title)) },
                navigationIcon = {
                    TextButton(onClick = actions.onCancel) {
                        Text(stringResource(R.string.action_cancel))
                    }
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
                        onClick = actions.onBack,
                        enabled = state.canGoBack,
                        modifier = Modifier.weight(1f).height(48.dp),
                    ) { Text(stringResource(R.string.action_back)) }
                    Button(
                        onClick = if (state.isLastStep) actions.onInstall else actions.onNext,
                        enabled = state.canGoNext,
                        modifier = Modifier.weight(2f).height(48.dp),
                    ) {
                        Text(
                            stringResource(
                                if (state.isLastStep) R.string.action_install else R.string.action_next,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(Spacing.md),
        ) {
            StepIndicator(state.step, state.totalSteps)
            Spacer(Modifier.height(Spacing.lg))
            when (state.step) {
                1 -> StepDistro(state, actions)
                2 -> StepDesktop(state, actions)
                3 -> StepResources(state, actions)
                else -> StepPermissions(state, actions)
            }
            Spacer(Modifier.height(Spacing.xl))
        }
    }
}

@Composable
private fun StepDistro(state: WizardUiState, actions: WizardActions) {
    Text(stringResource(R.string.wizard_step_distro), style = MaterialTheme.typography.titleLarge)
    Spacer(Modifier.height(Spacing.md))
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        modifier = Modifier.selectableGroup(),
    ) {
        state.distros.forEach { option ->
            val selected = option.spec.id == state.selectedDistroId
            SelectableCard(
                selected = selected,
                enabled = option.selectable,
                onClick = { actions.onDistro(option.spec.id) },
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(option.spec.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            formatBytes(option.spec.downloadBytes) + " " +
                                stringResource(R.string.label_download),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    CompatBadge(option.report.overall)
                }
                if (selected) {
                    Spacer(Modifier.height(Spacing.sm))
                    HorizontalDivider()
                    Spacer(Modifier.height(Spacing.sm))
                    option.report.signals.forEach {
                        SignalRow(it.label, it.detail, it.verdict)
                    }
                }
            }
        }
    }
}

@Composable
private fun StepDesktop(state: WizardUiState, actions: WizardActions) {
    Text(stringResource(R.string.wizard_step_desktop), style = MaterialTheme.typography.titleLarge)
    Spacer(Modifier.height(Spacing.md))
    Column(
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        modifier = Modifier.selectableGroup(),
    ) {
        state.desktops.forEach { spec ->
            SelectableCard(
                selected = spec.id == state.selectedDesktopId,
                enabled = true,
                onClick = { actions.onDesktop(spec.id) },
            ) {
                Text(spec.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    if (spec.installedBytes > 0) {
                        formatBytes(spec.installedBytes) + " " + stringResource(R.string.label_installed)
                    } else {
                        stringResource(R.string.desktop_none_hint)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StepResources(state: WizardUiState, actions: WizardActions) {
    Text(stringResource(R.string.wizard_step_resources), style = MaterialTheme.typography.titleLarge)
    Spacer(Modifier.height(Spacing.md))

    OutlinedTextField(
        value = state.machineName,
        onValueChange = actions.onName,
        label = { Text(stringResource(R.string.label_machine_name)) },
        singleLine = true,
        isError = state.nameError != null,
        supportingText = state.nameError?.let { err ->
            { Text(stringResource(nameErrorText(err))) }
        },
        modifier = Modifier.fillMaxWidth(),
    )

    SectionHeader(stringResource(R.string.label_profile))
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        ResourceProfile.entries.forEachIndexed { index, profile ->
            SegmentedButton(
                selected = state.profile == profile,
                onClick = { actions.onProfile(profile) },
                shape = SegmentedButtonDefaults.itemShape(index, ResourceProfile.entries.size),
            ) { Text(stringResource(profileLabel(profile))) }
        }
    }
    Spacer(Modifier.height(Spacing.xs))
    Text(
        stringResource(profileExplanation(state.profile)),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    SectionHeader(stringResource(R.string.label_resolution))
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
        state.resolutions.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                row.forEach { res ->
                    FilterChip(
                        selected = res == state.selectedResolution,
                        onClick = { actions.onResolution(res) },
                        label = { Text(res.label) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }

    SectionHeader(stringResource(R.string.label_storage))
    StorageSummary(state)
}

@Composable
private fun StorageSummary(state: WizardUiState) {
    val colors = NawahTheme.status
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(Spacing.md)) {
            SignalRow(
                stringResource(R.string.label_estimated_size),
                formatBytes(state.estimatedInstalledBytes),
                Compatibility.GOOD,
            )
            SignalRow(
                stringResource(R.string.label_free_space),
                formatBytes(state.availableStorageBytes),
                when {
                    state.storageIsInsufficient -> Compatibility.BLOCKED
                    state.storageIsTight -> Compatibility.TIGHT
                    else -> Compatibility.GOOD
                },
            )
            Spacer(Modifier.height(Spacing.xs))
            Text(
                stringResource(R.string.storage_estimate_note),
                style = MaterialTheme.typography.bodySmall,
                color = if (state.storageIsInsufficient) colors.bad
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun StepPermissions(state: WizardUiState, actions: WizardActions) {
    val p = state.permissions
    Text(stringResource(R.string.wizard_step_permissions), style = MaterialTheme.typography.titleLarge)
    Spacer(Modifier.height(Spacing.sm))

    ExplainedSwitch(
        stringResource(R.string.perm_audio), stringResource(R.string.perm_audio_help),
        p.audioOut,
    ) { actions.onPermissions(p.copy(audioOut = it)) }
    ExplainedSwitch(
        stringResource(R.string.perm_mic), stringResource(R.string.perm_mic_help),
        p.microphone,
    ) { actions.onPermissions(p.copy(microphone = it)) }
    ExplainedSwitch(
        stringResource(R.string.perm_storage), stringResource(R.string.perm_storage_help),
        p.storage,
    ) { actions.onPermissions(p.copy(storage = it)) }
    ExplainedSwitch(
        stringResource(R.string.perm_network), stringResource(R.string.perm_network_help),
        p.network,
    ) { actions.onPermissions(p.copy(network = it)) }

    SectionHeader(stringResource(R.string.label_summary))
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(Spacing.md)) {
            SignalRow(stringResource(R.string.label_machine_name), state.machineName, Compatibility.GOOD)
            SignalRow(
                stringResource(R.string.wizard_step_distro),
                state.selectedDistro?.spec?.name.orEmpty(), Compatibility.GOOD,
            )
            SignalRow(
                stringResource(R.string.wizard_step_desktop),
                state.selectedDesktop?.name.orEmpty(), Compatibility.GOOD,
            )
            SignalRow(
                stringResource(R.string.label_resolution),
                state.selectedResolution.label, Compatibility.GOOD,
            )
            SignalRow(
                stringResource(R.string.label_download),
                formatBytes(state.estimatedDownloadBytes), Compatibility.GOOD,
            )
        }
    }
}

private fun nameErrorText(err: NameError) = when (err) {
    NameError.EMPTY -> R.string.name_error_empty
    NameError.TOO_LONG -> R.string.name_error_too_long
    NameError.DUPLICATE -> R.string.name_error_duplicate
    NameError.ILLEGAL_CHARS -> R.string.name_error_illegal
}

private fun profileLabel(p: ResourceProfile) = when (p) {
    ResourceProfile.LIGHT -> R.string.profile_light
    ResourceProfile.BALANCED -> R.string.profile_balanced
    ResourceProfile.FULL -> R.string.profile_full
}

private fun profileExplanation(p: ResourceProfile) = when (p) {
    ResourceProfile.LIGHT -> R.string.profile_light_help
    ResourceProfile.BALANCED -> R.string.profile_balanced_help
    ResourceProfile.FULL -> R.string.profile_full_help
}

@Preview(name = "Wizard · distro")
@Composable
private fun PreviewWizard1() = NawahTheme {
    WizardScreen(previewWizard(1), WizardActions())
}

@Preview(name = "Wizard · resources")
@Composable
private fun PreviewWizard3() = NawahTheme {
    WizardScreen(previewWizard(3), WizardActions())
}

@Preview(name = "Wizard · permissions")
@Composable
private fun PreviewWizard4() = NawahTheme {
    WizardScreen(previewWizard(4), WizardActions())
}

private fun previewWizard(step: Int): WizardUiState {
    val distro = DistroSpec(
        "debian-trixie", "Debian 13", "trixie", "library/debian:trixie",
        49_700_000, 125_000_000, "http://deb.debian.org/debian",
    )
    val desktop = DesktopSpec("xfce4", "XFCE 4", listOf("xfce4"), "startxfce4", 950_000_000)
    val report = CompatReport(
        Compatibility.GOOD,
        listOf(
            CompatSignal("CPU type", "arm64-v8a", Compatibility.GOOD),
            CompatSignal("Memory", "6.0 GB", Compatibility.GOOD),
            CompatSignal("Storage", "22.4 GB free", Compatibility.GOOD),
        ),
        true,
    )
    return WizardUiState(
        step = step,
        distros = listOf(DistroOption(distro, report)),
        selectedDistroId = distro.id,
        desktops = listOf(desktop),
        selectedDesktopId = desktop.id,
        machineName = "Desktop",
        availableStorageBytes = 24_000_000_000,
    )
}
