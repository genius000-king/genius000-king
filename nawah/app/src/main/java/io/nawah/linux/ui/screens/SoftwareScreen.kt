package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.core.model.AppCategory
import io.nawah.linux.core.model.AppSpec
import io.nawah.linux.ui.components.SectionHeader
import io.nawah.linux.ui.components.SelectableCard
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.currentLanguage
import io.nawah.linux.ui.util.formatBytes
import androidx.compose.ui.platform.LocalContext

/**
 * Adding software to a system that already exists.
 *
 * The whole screen is here because the alternative was "install the system
 * again". A desktop is installed with `--no-install-recommends`, which is what
 * keeps it under a gigabyte and also why a fresh XFCE has no browser — so
 * adding to it afterwards has to be ordinary, not a repair.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SoftwareScreen(
    machineName: String,
    apps: List<AppSpec>,
    installedIds: Set<String>,
    selectedIds: Set<String>,
    onBack: () -> Unit,
    onToggle: (String, Boolean) -> Unit,
    onInstall: () -> Unit,
) {
    val language = LocalContext.current.currentLanguage()
    val chosen = apps.filter { it.id in selectedIds && it.id !in installedIds }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.software_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                Column(Modifier.fillMaxWidth().padding(Spacing.md)) {
                    Text(
                        if (chosen.isEmpty()) {
                            stringResource(R.string.software_none_selected)
                        } else {
                            formatBytes(chosen.sumOf { it.installedBytes })
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(Spacing.sm))
                    Button(
                        onClick = onInstall,
                        enabled = chosen.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                    ) {
                        Text(stringResource(R.string.software_install))
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
                .padding(horizontal = Spacing.md)
                .padding(bottom = Spacing.md),
        ) {
            Text(
                machineName,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            AppCategory.entries.forEach { category ->
                val inCategory = apps.filter { it.category == category }
                if (inCategory.isEmpty()) return@forEach
                SectionHeader(stringResource(categoryLabel(category)))
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    inCategory.forEach { app ->
                        val installed = app.id in installedIds
                        SelectableCard(
                            selected = installed || app.id in selectedIds,
                            enabled = !installed,
                            onClick = { onToggle(app.id, app.id !in selectedIds) },
                        ) {
                            Row(verticalAlignment = Alignment.Top) {
                                if (installed) {
                                    Text(
                                        stringResource(R.string.software_installed),
                                        style = MaterialTheme.typography.labelMedium,
                                        color = NawahTheme.status.good,
                                    )
                                } else {
                                    Checkbox(checked = app.id in selectedIds, onCheckedChange = null)
                                }
                                Spacer(Modifier.width(Spacing.sm))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        app.name.resolve(language),
                                        style = MaterialTheme.typography.titleSmall,
                                    )
                                    Text(
                                        app.description.resolve(language),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                Spacer(Modifier.width(Spacing.sm))
                                Text(
                                    formatBytes(app.installedBytes),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
