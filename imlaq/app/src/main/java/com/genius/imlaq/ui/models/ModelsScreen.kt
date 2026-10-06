package com.genius.imlaq.ui.models

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.genius.imlaq.R
import com.genius.imlaq.designsystem.CardShape
import com.genius.imlaq.designsystem.GhostButton
import com.genius.imlaq.designsystem.IconCircle
import com.genius.imlaq.designsystem.Imlaq
import com.genius.imlaq.designsystem.ImlaqIcons
import com.genius.imlaq.designsystem.PillButton
import com.genius.imlaq.designsystem.ProgressTrack
import com.genius.imlaq.designsystem.StatusDot
import com.genius.imlaq.designsystem.glass
import com.genius.imlaq.models.catalog.CatalogEntry
import com.genius.imlaq.models.catalog.FitLevel
import com.genius.imlaq.models.download.DownloadState
import com.genius.imlaq.ui.formatGb

interface ModelsActions {
    fun download(entry: CatalogEntry)
    fun cancelDownload(entry: CatalogEntry)
    fun run(row: InstalledRow)
    fun stop()
    fun armDelete(row: InstalledRow?)
    fun delete(row: InstalledRow)
}

@Composable
fun ModelsScreen(state: ModelsUiState, actions: ModelsActions, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    LazyColumn(
        modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Column(Modifier.padding(horizontal = 4.dp)) {
                Text(stringResource(R.string.models_title), style = MaterialTheme.typography.headlineMedium, color = c.text)
                Text(stringResource(R.string.models_subtitle), style = MaterialTheme.typography.bodyMedium, color = c.muted)
            }
        }
        item { SectionLabel(stringResource(R.string.models_installed)) }
        if (!state.loading && state.installed.isEmpty()) {
            item {
                Text(
                    stringResource(R.string.models_installed_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.faint,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
        items(state.installed, key = { it.model.entry.path }) { row ->
            InstalledCard(row, armed = state.deleteArmed == row.model.entry.path, actions)
        }
        if (state.available.isNotEmpty()) {
            item { SectionLabel(stringResource(R.string.models_available)) }
            items(state.available, key = { it.entry.id }) { row -> AvailableCard(row, actions) }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = Imlaq.colors.faint,
        modifier = Modifier.padding(start = 4.dp, top = 14.dp),
    )
}

@Composable
private fun ModelCard(
    title: String,
    bytes: Long,
    action: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    val c = Imlaq.colors
    Column(
        Modifier.fillMaxWidth().glass(CardShape).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = c.text)
                Text(stringResource(R.string.size_gb, formatGb(bytes)), style = MaterialTheme.typography.bodySmall, color = c.muted)
            }
            action()
        }
        content()
    }
}

@Composable
private fun InstalledCard(row: InstalledRow, armed: Boolean, actions: ModelsActions) {
    val c = Imlaq.colors
    ModelCard(
        title = row.title,
        bytes = row.bytes,
        action = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                when (row.status) {
                    RunStatus.RUNNING -> GhostButton(stringResource(R.string.action_stop), onClick = actions::stop)
                    RunStatus.LOADING -> GhostButton(stringResource(R.string.status_loading), onClick = {}, enabled = false)
                    else -> PillButton(stringResource(R.string.action_run), onClick = { actions.run(row) }, icon = ImlaqIcons.Play, small = true)
                }
                IconCircle(
                    ImlaqIcons.Trash,
                    contentDescription = stringResource(R.string.action_delete_model),
                    onClick = { actions.armDelete(if (armed) null else row) },
                    tint = if (armed) c.bad else c.muted,
                )
            }
        },
    ) {
        when (row.status) {
            RunStatus.RUNNING -> StatusDot(stringResource(R.string.status_running), c.ok)
            RunStatus.LOADING -> StatusDot(stringResource(R.string.status_loading), c.warn)
            RunStatus.FAILED -> StatusDot(stringResource(R.string.status_failed, row.failure.orEmpty()), c.bad)
            RunStatus.IDLE -> StatusDot(stringResource(R.string.status_ready), c.ok)
        }
        if (armed) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.delete_confirm, formatGb(row.bytes)),
                    style = MaterialTheme.typography.bodySmall,
                    color = c.muted,
                    modifier = Modifier.weight(1f),
                )
                GhostButton(stringResource(R.string.action_keep), onClick = { actions.armDelete(null) })
                GhostButton(stringResource(R.string.action_delete), onClick = { actions.delete(row) }, color = c.bad)
            }
        }
    }
}

@Composable
private fun AvailableCard(row: AvailableRow, actions: ModelsActions) {
    val c = Imlaq.colors
    val entry = row.entry
    val canDownload = row.fit.level == FitLevel.GOOD || row.fit.level == FitLevel.SLOW
    ModelCard(
        title = entry.name,
        bytes = entry.totalBytes,
        action = {
            when (row.download) {
                is DownloadState.Running -> GhostButton(stringResource(R.string.action_stop), onClick = { actions.cancelDownload(entry) })
                is DownloadState.Failed -> GhostButton(stringResource(R.string.action_retry), onClick = { actions.download(entry) })
                DownloadState.Idle -> GhostButton(
                    stringResource(R.string.action_download),
                    onClick = { actions.download(entry) },
                    icon = ImlaqIcons.ArrowDown,
                    enabled = canDownload,
                )
            }
        },
    ) {
        when (val d = row.download) {
            is DownloadState.Running -> {
                val pct = (d.fraction * 100).toInt()
                Text(
                    if (d.done > 0) stringResource(R.string.download_progress, pct, formatGb(d.done), formatGb(d.total))
                    else stringResource(R.string.download_waiting),
                    style = MaterialTheme.typography.bodySmall,
                    color = c.muted,
                )
                ProgressTrack(d.fraction)
            }
            is DownloadState.Failed -> StatusDot(stringResource(R.string.download_failed, d.message), c.bad)
            DownloadState.Idle -> FitLine(row)
        }
    }
}

@Composable
private fun FitLine(row: AvailableRow) {
    val c = Imlaq.colors
    when (row.fit.level) {
        FitLevel.GOOD -> StatusDot(stringResource(R.string.fit_good), c.ok)
        FitLevel.SLOW -> StatusDot(stringResource(R.string.fit_slow), c.warn)
        FitLevel.NO_SPACE -> StatusDot(stringResource(R.string.fit_no_space, formatGb(row.fit.missing.value)), c.bad)
        FitLevel.NOT_ENOUGH_RAM -> StatusDot(stringResource(R.string.fit_no_ram, row.entry.minRam.gib.toInt()), c.bad)
    }
}
