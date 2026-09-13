package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import io.nawah.linux.R
import io.nawah.linux.settings.AppLanguage
import io.nawah.linux.ui.components.ExplainedSwitch
import io.nawah.linux.ui.components.SectionHeader
import io.nawah.linux.ui.state.AppSettingsUiState
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.formatBytes

/**
 * The app's own settings, as opposed to one machine's.
 *
 * Deliberately short. A settings screen is where an app hides the decisions it
 * could not make for the user, and most of these it can: the language follows
 * the phone, the screen does not stay on, the desktop opens when you press Run.
 * What is here is what a person genuinely wants to change.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppSettingsScreen(
    state: AppSettingsUiState,
    onBack: () -> Unit,
    onLanguage: (AppLanguage) -> Unit,
    onKeepScreenOn: (Boolean) -> Unit,
    onOpenDisplayOnRun: (Boolean) -> Unit,
    onDiagnostics: () -> Unit,
    onAbout: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.settings_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.md)
                .padding(bottom = Spacing.xl),
        ) {
            SectionHeader(stringResource(R.string.settings_section_appearance))
            LanguagePicker(state.language, onLanguage)
            Text(
                stringResource(R.string.settings_language_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = Spacing.xs),
            )

            SectionHeader(stringResource(R.string.settings_section_session))
            ExplainedSwitch(
                title = stringResource(R.string.settings_open_display),
                explanation = stringResource(R.string.settings_open_display_desc),
                checked = state.openDisplayOnRun,
                onCheckedChange = onOpenDisplayOnRun,
            )
            ExplainedSwitch(
                title = stringResource(R.string.settings_keep_screen_on),
                explanation = stringResource(R.string.settings_keep_screen_on_desc),
                checked = state.keepScreenOn,
                onCheckedChange = onKeepScreenOn,
            )

            SectionHeader(stringResource(R.string.settings_section_storage))
            ValueRow(
                stringResource(R.string.settings_storage_used),
                if (state.usedBytes >= 0) formatBytes(state.usedBytes) else "—",
            )
            ValueRow(stringResource(R.string.settings_storage_free), formatBytes(state.freeBytes))

            SectionHeader(stringResource(R.string.settings_section_support))
            NavigationRow(
                title = stringResource(R.string.action_diagnostics),
                subtitle = stringResource(R.string.settings_diagnostics_desc),
                onClick = onDiagnostics,
            )
            NavigationRow(
                title = stringResource(R.string.action_about),
                subtitle = null,
                onClick = onAbout,
            )
        }
    }
}

@Composable
private fun LanguagePicker(selected: AppLanguage, onSelect: (AppLanguage) -> Unit) {
    val labels = mapOf(
        AppLanguage.SYSTEM to R.string.settings_language_system,
        AppLanguage.ARABIC to R.string.settings_language_ar,
        AppLanguage.ENGLISH to R.string.settings_language_en,
    )
    Column(Modifier.selectableGroup()) {
        AppLanguage.entries.forEach { language ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = language == selected,
                        role = Role.RadioButton,
                        onClick = { onSelect(language) },
                    )
                    .padding(vertical = Spacing.sm),
            ) {
                RadioButton(selected = language == selected, onClick = null)
                Spacer(Modifier.width(Spacing.sm))
                Text(stringResource(labels.getValue(language)))
            }
        }
    }
}

@Composable
private fun ValueRow(label: String, value: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun NavigationRow(title: String, subtitle: String?, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(vertical = Spacing.sm)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Preview
@Composable
private fun PreviewAppSettings() = NawahTheme {
    AppSettingsScreen(
        AppSettingsUiState(usedBytes = 2_400_000_000, freeBytes = 18_000_000_000, machineCount = 2),
        {}, {}, {}, {}, {}, {},
    )
}
