package io.nawah.linux.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.core.model.*
import io.nawah.linux.ui.components.StateChip
import io.nawah.linux.ui.state.HomeUiState
import io.nawah.linux.ui.state.MachineListItem
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing
import io.nawah.linux.ui.util.formatBytes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: HomeUiState,
    onCreate: () -> Unit,
    onRun: (String) -> Unit,
    onResume: (String) -> Unit,
    onSettings: (String) -> Unit,
    onRepair: (String) -> Unit,
    onDelete: (String) -> Unit,
    onDiagnostics: () -> Unit,
    onAppSettings: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.app_name)) },
                actions = {
                    IconButton(onClick = onAppSettings) {
                        Icon(Icons.Default.Settings, stringResource(R.string.action_settings))
                    }
                },
            )
        },
        floatingActionButton = {
            if (!state.isEmpty) {
                ExtendedFloatingActionButton(
                    onClick = onCreate,
                    icon = { Icon(Icons.Default.Add, null) },
                    text = { Text(stringResource(R.string.action_create_system)) },
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            TuxWatermark(Modifier.align(Alignment.Center))

            when {
                state.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    CircularProgressIndicator()
                }

                state.isEmpty -> EmptyHome(Modifier, onCreate)

                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(Spacing.md, Spacing.md, Spacing.md, 96.dp),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    items(state.machines, key = { it.id }) { item ->
                        MachineCard(item, onRun, onResume, onSettings, onRepair, onDelete)
                    }
                }
            }
        }
    }
}

/**
 * Tux, sitting in the empty half of the home screen.
 *
 * Behind everything and outside the layout: it is drawn in a Box under the
 * list, so a long list simply covers it and a short one leaves it visible.
 * `contentDescription = null` and no pointer input at all — a screen reader has
 * nothing to say about wallpaper, and a watermark that swallows a tap on the
 * card above it is a bug.
 *
 * The mark itself is the upstream Tux, unmodified.
 */
@Composable
private fun TuxWatermark(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.tux),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = modifier
            .fillMaxWidth(TUX_WIDTH_FRACTION)
            .padding(top = 72.dp)
            .alpha(TUX_ALPHA),
    )
}

/** Present enough to be the app's face, faint enough not to fight a card. */
private const val TUX_ALPHA = 0.32f
private const val TUX_WIDTH_FRACTION = 0.62f

@Composable
private fun EmptyHome(modifier: Modifier, onCreate: () -> Unit) {
    Column(
        modifier.fillMaxSize().padding(Spacing.xl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            stringResource(R.string.home_empty_title),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.sm))
        Text(
            stringResource(R.string.home_empty_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.xl))
        Button(onClick = onCreate, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text(stringResource(R.string.action_create_system))
        }
    }
}

@Composable
private fun MachineCard(
    item: MachineListItem,
    onRun: (String) -> Unit,
    onResume: (String) -> Unit,
    onSettings: (String) -> Unit,
    onRepair: (String) -> Unit,
    onDelete: (String) -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    val colors = NawahTheme.status
    val runnable = item.state == MachineState.READY

    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(Spacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(item.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${item.distroName} · ${item.desktopName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, stringResource(R.string.action_more))
                    }
                    DropdownMenu(menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.action_settings)) },
                            onClick = { menuOpen = false; onSettings(item.id) },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.action_repair_bridge)) },
                            onClick = { menuOpen = false; onRepair(item.id) },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.action_delete)) },
                            onClick = { menuOpen = false; onDelete(item.id) },
                        )
                    }
                }
            }

            Spacer(Modifier.height(Spacing.sm))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val (label, fg, bg) = when (item.state) {
                    MachineState.READY -> Triple(
                        stringResource(R.string.state_ready), colors.good, colors.goodContainer,
                    )
                    MachineState.INSTALLING -> Triple(
                        stringResource(R.string.state_installing), colors.warn, colors.warnContainer,
                    )
                    MachineState.FAILED -> Triple(
                        stringResource(R.string.state_failed), colors.bad, colors.badContainer,
                    )
                    MachineState.NEEDS_REPAIR -> Triple(
                        stringResource(R.string.state_needs_repair), colors.warn, colors.warnContainer,
                    )
                }
                StateChip(label, fg, bg)
                if (item.diskUsageBytes >= 0) {
                    Spacer(Modifier.width(Spacing.sm))
                    Text(
                        formatBytes(item.diskUsageBytes),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.weight(1f))
                // A half-installed machine offers the one action that helps.
                // Leaving only a greyed-out Run button is a dead end: the user
                // can see something is wrong and do nothing about it.
                if (item.resumable) {
                    Button(onClick = { onResume(item.id) }) {
                        Icon(Icons.Default.Refresh, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(Spacing.xs))
                        Text(stringResource(R.string.action_resume))
                    }
                } else {
                    Button(onClick = { onRun(item.id) }, enabled = runnable) {
                        Icon(Icons.Default.PlayArrow, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(Spacing.xs))
                        Text(stringResource(R.string.action_run))
                    }
                }
            }
        }
    }
}

@Preview(name = "Home · empty")
@Composable
private fun PreviewHomeEmpty() = NawahTheme {
    HomeScreen(HomeUiState(), {}, {}, {}, {}, {}, {}, {}, {})
}

@Preview(name = "Home · machines")
@Composable
private fun PreviewHome() = NawahTheme {
    HomeScreen(HomeUiState(machines = previewMachines()), {}, {}, {}, {}, {}, {}, {}, {})
}

internal fun previewMachines(): List<MachineListItem> = listOf(
    MachineListItem(
        previewMachine("desk", "Desktop", MachineState.READY),
        "Debian 13", "XFCE 4", 2_400_000_000,
    ),
    MachineListItem(
        previewMachine("build", "Build box", MachineState.FAILED),
        "Debian 12", "Command line only", 172_000_000, resumable = true,
    ),
)

internal fun previewMachine(id: String, name: String, state: MachineState) = Machine(
    id = id, name = name, distroId = "debian-trixie", desktopId = "xfce4",
    profile = ResourceProfile.BALANCED, permissions = MachinePermissions(),
    displayWidth = 1280, displayHeight = 720,
    createdAtEpochMs = 0L, state = state,
)
