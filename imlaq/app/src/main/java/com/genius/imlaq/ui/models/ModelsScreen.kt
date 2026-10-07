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
import com.genius.imlaq.models.ModelType
import com.genius.imlaq.models.catalog.CatalogEntry
import com.genius.imlaq.models.catalog.Fit
import com.genius.imlaq.models.catalog.FitLevel
import com.genius.imlaq.models.download.ActiveTransfer
import com.genius.imlaq.models.download.DownloadState
import com.genius.imlaq.ui.formatGb

interface ModelsActions {
    fun addFromPhone()
    fun addFromInternet()
    fun downloadSuggested(entry: CatalogEntry)
    fun cancel(transfer: ActiveTransfer)
    fun retry(transfer: ActiveTransfer)
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
        item {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton(stringResource(R.string.add_from_phone), onClick = actions::addFromPhone, icon = ImlaqIcons.Phone, small = false, modifier = Modifier.weight(1f))
                PillButton(stringResource(R.string.add_from_internet), onClick = actions::addFromInternet, icon = ImlaqIcons.Globe, modifier = Modifier.weight(1f))
            }
        }
        state.notice?.let { note ->
            item { StatusDot(note, c.bad, Modifier.padding(horizontal = 4.dp)) }
        }

        if (state.transfers.isNotEmpty()) {
            item { SectionLabel(stringResource(R.string.models_transfers)) }
            items(state.transfers, key = { "t:" + it.spec.id }) { TransferCard(it, actions) }
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
        items(state.installed, key = { "i:" + it.model.entry.path }) { row ->
            InstalledCard(row, armed = state.deleteArmed == row.model.entry.path, actions)
        }

        if (state.suggested.isNotEmpty()) {
            item { SectionLabel(stringResource(R.string.models_suggested)) }
            items(state.suggested, key = { "s:" + it.entry.id }) { SuggestedCard(it, actions) }
        }
    }
}

@Composable
internal fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = Imlaq.colors.faint,
        modifier = Modifier.padding(start = 4.dp, top = 14.dp),
    )
}

/** The card every model is shown in: title, what it does and its size, an action at the end, details below. */
@Composable
internal fun ModelCard(
    title: String,
    bytes: Long,
    type: ModelType?,
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
                Text(title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 2)
                Row(
                    Modifier.padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (type != null) TypeChip(type)
                    if (bytes > 0) {
                        Text(stringResource(R.string.size_gb, formatGb(bytes)), style = MaterialTheme.typography.bodySmall, color = c.muted)
                    }
                }
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
        type = row.type,
        action = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                when (row.status) {
                    RunStatus.RUNNING -> GhostButton(stringResource(R.string.action_stop), onClick = actions::stop)
                    RunStatus.LOADING -> GhostButton(stringResource(R.string.status_loading), onClick = {}, enabled = false)
                    RunStatus.UNSUPPORTED, RunStatus.COMPANION -> Unit
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
            RunStatus.UNSUPPORTED -> StatusDot(stringResource(R.string.status_unsupported), c.faint)
            RunStatus.COMPANION -> StatusDot(stringResource(R.string.status_projector), c.faint)
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
private fun TransferCard(t: ActiveTransfer, actions: ModelsActions) {
    val c = Imlaq.colors
    ModelCard(
        title = t.spec.title,
        bytes = t.spec.totalBytes,
        type = t.spec.type,
        action = {
            when (t.state) {
                is DownloadState.Failed -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconCircle(ImlaqIcons.Close, stringResource(R.string.action_stop), onClick = { actions.cancel(t) }, tint = c.muted)
                    GhostButton(stringResource(R.string.action_retry), onClick = { actions.retry(t) })
                }
                else -> GhostButton(stringResource(R.string.action_stop), onClick = { actions.cancel(t) })
            }
        },
    ) {
        when (val d = t.state) {
            is DownloadState.Running -> {
                Text(
                    if (d.done > 0) stringResource(R.string.download_progress, (d.fraction * 100).toInt(), formatGb(d.done), formatGb(d.total))
                    else stringResource(R.string.download_waiting),
                    style = MaterialTheme.typography.bodySmall,
                    color = c.muted,
                )
                ProgressTrack(d.fraction)
            }
            is DownloadState.Failed -> StatusDot(stringResource(R.string.download_failed, d.message), c.bad)
            DownloadState.Idle -> Unit
        }
    }
}

@Composable
private fun SuggestedCard(row: SuggestedRow, actions: ModelsActions) {
    val canDownload = row.fit.level != FitLevel.NO_SPACE && row.fit.level != FitLevel.NOT_ENOUGH_RAM
    ModelCard(
        title = row.entry.name,
        bytes = row.entry.totalBytes,
        type = ModelType.TEXT,
        action = {
            GhostButton(
                stringResource(R.string.action_download),
                onClick = { actions.downloadSuggested(row.entry) },
                icon = ImlaqIcons.ArrowDown,
                enabled = canDownload,
            )
        },
    ) { FitLine(row.fit, minRamGb = row.entry.minRam.gib.toInt()) }
}

/** One coloured line that says what a model means for this phone. */
@Composable
internal fun FitLine(fit: Fit, minRamGb: Int = 0) {
    val c = Imlaq.colors
    when (fit.level) {
        FitLevel.GOOD -> StatusDot(stringResource(R.string.fit_good), c.ok)
        FitLevel.FITS_RAM -> StatusDot(stringResource(R.string.fit_in_ram), c.ok)
        FitLevel.SLOW -> StatusDot(stringResource(R.string.fit_slow), c.warn)
        FitLevel.STREAMS -> StatusDot(stringResource(R.string.fit_streams), c.warn)
        FitLevel.NO_SPACE -> StatusDot(stringResource(R.string.fit_no_space, formatGb(fit.missing.value)), c.bad)
        FitLevel.NOT_ENOUGH_RAM -> StatusDot(stringResource(R.string.fit_no_ram, minRamGb), c.bad)
    }
}
