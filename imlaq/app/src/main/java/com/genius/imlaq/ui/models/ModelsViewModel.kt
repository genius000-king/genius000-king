package com.genius.imlaq.ui.models

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.imlaq.AppContainer
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.models.catalog.Catalog
import com.genius.imlaq.models.catalog.CatalogEntry
import com.genius.imlaq.models.catalog.Fit
import com.genius.imlaq.models.catalog.FitJudge
import com.genius.imlaq.models.download.DownloadState
import com.genius.imlaq.session.SessionState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class RunStatus { IDLE, LOADING, RUNNING, FAILED }

data class InstalledRow(
    val model: LocalModel,
    val title: String,
    val bytes: Long,
    val status: RunStatus,
    val failure: String? = null,
)

data class AvailableRow(val entry: CatalogEntry, val fit: Fit, val download: DownloadState)

data class ModelsUiState(
    val loading: Boolean = true,
    val installed: List<InstalledRow> = emptyList(),
    val available: List<AvailableRow> = emptyList(),
    /** The installed model whose delete is waiting for a "yes". */
    val deleteArmed: String? = null,
)

/** What the disk and the phone say, re-read after every download and delete. */
private data class Scan(val models: List<LocalModel>, val totalRam: Bytes, val freeStorage: Bytes, val partial: Map<String, Bytes>)

class ModelsViewModel(private val container: AppContainer) : ViewModel() {

    private val scan = MutableStateFlow<Scan?>(null)
    private val armed = MutableStateFlow<String?>(null)
    private val downloads = combine(Catalog.entries.map { container.downloads.state(it) }) { it.toList() }

    val state: StateFlow<ModelsUiState> =
        combine(scan, container.session.state, downloads, armed) { s, session, dl, armedPath ->
            if (s == null) return@combine ModelsUiState(loading = true)
            val installedFiles = s.models.filter { it.complete }
            val installed = installedFiles.map { m ->
                val bytes = m.shards.sumOf { it.length() }
                val (status, failure) = statusOf(m, session)
                InstalledRow(m, titleOf(m), bytes, status, failure)
            }
            val installedIds = installedFiles.mapNotNull { Catalog.ownerOf(it.entry.name)?.id }.toSet()
            val available = Catalog.entries.mapIndexedNotNull { i, entry ->
                if (entry.id in installedIds) return@mapIndexedNotNull null
                val partial = s.partial[entry.id] ?: Bytes.ZERO
                AvailableRow(entry, FitJudge.assess(entry, s.totalRam, s.freeStorage, partial), dl[i])
            }
            ModelsUiState(loading = false, installed = installed, available = available, deleteArmed = armedPath)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ModelsUiState())

    init {
        refresh()
        // A download that leaves the running state has either finished or failed: rescan.
        viewModelScope.launch {
            var wasRunning = emptySet<Int>()
            downloads.collect { list ->
                val running = list.indices.filter { list[it] is DownloadState.Running }.toSet()
                if ((wasRunning - running).isNotEmpty()) refresh()
                wasRunning = running
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            scan.value = withContext(Dispatchers.IO) {
                val profile = container.deviceProfiler.profile(container.modelsDir)
                Scan(
                    models = container.modelStore.list(),
                    totalRam = profile.memory.total,
                    freeStorage = profile.modelStorageFree,
                    partial = Catalog.entries.associate { it.id to container.downloads.partialBytes(it) },
                )
            }
        }
    }

    fun download(entry: CatalogEntry) = container.downloads.start(entry)

    fun cancelDownload(entry: CatalogEntry) {
        container.downloads.cancel(entry)
        refresh()
    }

    fun run(row: InstalledRow) = container.session.load(row.model, row.title)

    fun stop() = container.session.unload()

    fun armDelete(row: InstalledRow?) {
        armed.value = row?.model?.entry?.path
    }

    fun delete(row: InstalledRow) {
        armed.value = null
        viewModelScope.launch {
            if (statusOf(row.model, container.session.state.value).first != RunStatus.IDLE) container.session.unload()
            withContext(Dispatchers.IO) { row.model.shards.forEach { it.delete() } }
            refresh()
        }
    }

    private fun titleOf(m: LocalModel) =
        Catalog.ownerOf(m.entry.name)?.name ?: m.summary?.name ?: m.entry.name.removeSuffix(".gguf")

    private fun statusOf(m: LocalModel, s: SessionState): Pair<RunStatus, String?> = when {
        s is SessionState.Loading && s.model.file == m.entry -> RunStatus.LOADING to null
        s is SessionState.Ready && s.model.file == m.entry -> RunStatus.RUNNING to null
        s is SessionState.Failed && s.model.file == m.entry -> RunStatus.FAILED to s.message
        else -> RunStatus.IDLE to null
    }
}
