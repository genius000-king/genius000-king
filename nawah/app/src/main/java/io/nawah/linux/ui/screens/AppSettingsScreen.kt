package io.nawah.linux.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.Usb
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.settings.AppLanguage
import io.nawah.linux.ui.state.AppSettingsUiState
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.formatBytes

/**
 * The app's own settings, as opposed to one machine's.
 *
 * Grouped into cards rather than run together as one list. A settings screen is
 * read by scanning for a heading, and a flat column of switches and radio
 * buttons with nothing but a small grey word between them gives the eye nothing
 * to land on — which is exactly how the first version of this screen read.
 *
 * Deliberately short, too. Most of these decisions the app can make: the
 * language follows the phone, the screen does not stay on, the desktop opens
 * when you press Run. What is here is what a person genuinely wants to change.
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
    onUsb: () -> Unit,
    onAbout: () -> Unit,
) {
    Scaffold(
        topBar = {
            LargeTopAppBar(
                title = { Text(stringResource(R.string.app_settings_title)) },
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
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            SettingsGroup(stringResource(R.string.settings_section_appearance)) {
                AppLanguage.entries.forEachIndexed { index, language ->
                    if (index > 0) GroupDivider()
                    LanguageRow(
                        label = stringResource(languageLabel(language)),
                        selected = language == state.language,
                        onSelect = { onLanguage(language) },
                    )
                }
                Footnote(stringResource(R.string.settings_language_note))
            }

            SettingsGroup(stringResource(R.string.settings_section_session)) {
                SwitchRow(
                    title = stringResource(R.string.settings_open_display),
                    description = stringResource(R.string.settings_open_display_desc),
                    checked = state.openDisplayOnRun,
                    onCheckedChange = onOpenDisplayOnRun,
                )
                GroupDivider()
                SwitchRow(
                    title = stringResource(R.string.settings_keep_screen_on),
                    description = stringResource(R.string.settings_keep_screen_on_desc),
                    checked = state.keepScreenOn,
                    onCheckedChange = onKeepScreenOn,
                )
            }

            SettingsGroup(stringResource(R.string.settings_section_hardware)) {
                NavigationRow(
                    icon = Icons.Filled.Usb,
                    title = stringResource(R.string.usb_title),
                    subtitle = stringResource(R.string.usb_settings_desc),
                    onClick = onUsb,
                )
            }

            SettingsGroup(stringResource(R.string.settings_section_storage)) {
                StorageBar(state)
            }

            SettingsGroup(stringResource(R.string.settings_section_support)) {
                NavigationRow(
                    icon = Icons.Filled.MonitorHeart,
                    title = stringResource(R.string.action_diagnostics),
                    subtitle = stringResource(R.string.settings_diagnostics_desc),
                    onClick = onDiagnostics,
                )
                GroupDivider()
                NavigationRow(
                    icon = Icons.Filled.Info,
                    title = stringResource(R.string.action_about),
                    subtitle = null,
                    onClick = onAbout,
                )
            }
        }
    }
}

private fun languageLabel(language: AppLanguage): Int = when (language) {
    AppLanguage.SYSTEM -> R.string.settings_language_system
    AppLanguage.ARABIC -> R.string.settings_language_ar
    AppLanguage.ENGLISH -> R.string.settings_language_en
}

/** A titled card. The title sits outside it, the way Android's own do. */
@Composable
private fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(start = Spacing.md, bottom = Spacing.xs),
        )
        Surface(
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(vertical = Spacing.xs), content = content)
        }
    }
}

@Composable
private fun GroupDivider() = HorizontalDivider(
    Modifier.padding(horizontal = Spacing.md),
    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
)

@Composable
private fun LanguageRow(label: String, selected: Boolean, onSelect: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, role = Role.RadioButton, onClick = onSelect)
            .padding(horizontal = Spacing.md, vertical = Spacing.sm)
            .heightIn(min = 40.dp),
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(Modifier.width(Spacing.md))
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun SwitchRow(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            // The whole row toggles, not just the switch: a two-line
            // description beside a switch is a large target that does nothing
            // if only the switch is live, and people tap the words.
            .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange)
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
    ) {
        Column(Modifier.weight(1f).padding(end = Spacing.md)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(
                description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = null)
    }
}

@Composable
private fun NavigationRow(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.md, vertical = Spacing.sm)
            .heightIn(min = 48.dp),
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            null,
            tint = MaterialTheme.colorScheme.outline,
        )
    }
}

/**
 * How much of the phone the systems have taken, as a bar and two numbers.
 *
 * Two right-aligned figures told nobody anything. What a person wants here is
 * the proportion, and a bar answers that before the numbers are read.
 */
@Composable
private fun StorageBar(state: AppSettingsUiState) {
    val used = state.usedBytes.coerceAtLeast(0)
    val total = used + state.freeBytes
    Column(Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm)) {
        LinearProgressIndicator(
            progress = { if (total > 0) used.toFloat() / total else 0f },
            modifier = Modifier.fillMaxWidth().height(8.dp),
            strokeCap = androidx.compose.ui.graphics.StrokeCap.Round,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )
        Spacer(Modifier.height(Spacing.sm))
        Row {
            Legend(
                label = stringResource(R.string.app_settings_storage_used),
                value = if (state.usedBytes >= 0) formatBytes(used) else "—",
                modifier = Modifier.weight(1f),
            )
            Legend(
                label = stringResource(R.string.settings_storage_free),
                value = formatBytes(state.freeBytes),
                modifier = Modifier.weight(1f),
                alignEnd = true,
            )
        }
    }
}

@Composable
private fun Legend(label: String, value: String, modifier: Modifier, alignEnd: Boolean = false) {
    Column(
        modifier,
        horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start,
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium)
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = if (alignEnd) TextAlign.End else TextAlign.Start,
        )
    }
}

@Composable
private fun Footnote(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
    )
}

@Preview
@Composable
private fun PreviewAppSettings() = NawahTheme {
    AppSettingsScreen(
        AppSettingsUiState(usedBytes = 2_400_000_000, freeBytes = 18_000_000_000, machineCount = 2),
        {}, {}, {}, {}, {}, {}, {},
    )
}
