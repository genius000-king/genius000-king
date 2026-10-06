package com.genius.imlaq.ui.models

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.imlaq.AppContainer
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.models.ModelKind
import com.genius.imlaq.models.catalog.Catalog
import com.genius.imlaq.models.catalog.CatalogEntry
import com.genius.imlaq.models.catalog.Fit
import com.genius.imlaq.models.catalog.FitJudge
import com.genius.imlaq.models.download.ActiveTransfer
import com.genius.imlaq.models.download.DownloadSpec
import com.genius.imlaq.models.download.TransferFile
import com.genius.imlaq.session.SessionState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class RunStatus { IDLE, LOADING, RUNNING, FAILED, UNSUPPORTED }

data class InstalledRow(
    val model: LocalModel,
    val title: String,
    val bytes: Long,
    val status: RunStatus,
    val failure: String? = null,
)

data class SuggestedRow(val entry: CatalogEntry, val fit: Fit)

data class ModelsUiState(
    val loading: Boolean = true,
    val installed: List<InstalledRow> = emptyList(),
    val transfers: List<ActiveTransfer> = emptyList(),
    val suggested: List<SuggestedRow> = emptyList(),
    /** The installed model whose delete is waiting for a "yes". */
    val deleteArmed: String? = null,
    /** A one-line problem to show (e.g. the picked file is not a model). */
    val notice: String? = null,
)

/** What the disk and the phone say, re-read after every transfer and delete. */
private data class Scan(val models: List<LocalModel>, val totalRam: Bytes, val freeStorage: Bytes)

class ModelsViewModel(private val container: AppContainer, private val context: Context) : ViewModel() {

    private val scan = MutableStateFlow<Scan?>(null)
    private val armed = MutableStateFlow<String?>(null)
    private val notice = MutableStateFlow<String?>(null)
    private val transfers = container.downloads.active()

    val state: StateFlow<ModelsUiState> =
        combine(scan, container.session.state, transfers, armed, notice) { s, session, active, armedPath, note ->
            if (s == null) return@combine ModelsUiState(loading = true)
            val busyNames = active.flatMap { t -> t.spec.files.map { it.name } }.toSet()
            val installed = s.models
                .filter { it.complete && it.entry.name !in busyNames }
                .map { m ->
                    val (status, failure) = statusOf(m, session)
                    InstalledRow(m, titleOf(m), m.shards.sumOf { it.length() }, status, failure)
                }
            val present = installed.map { it.model.entry.name }.toSet() + busyNames
            val suggested = Catalog.entries
                .filter { e -> e.files.none { it.name in present } }
                .map { SuggestedRow(it, FitJudge.assess(it, s.totalRam, s.freeStorage)) }
            ModelsUiState(false, installed, active, suggested, armedPath, note)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ModelsUiState())

    /** For the online page: what any model's size means on this phone. */
    fun fitForSize(bytes: Long): Fit? = scan.value?.let { FitJudge.assessSize(bytes, it.totalRam, it.freeStorage) }

    init {
        refresh()
        // A transfer that disappears from the active list has finished (or was cancelled): rescan.
        viewModelScope.launch {
            var before = emptySet<String>()
            transfers.collect { list ->
                val now = list.map { it.spec.id }.toSet()
                if ((before - now).isNotEmpty()) refresh()
                before = now
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            scan.value = withContext(Dispatchers.IO) {
                val profile = container.deviceProfiler.profile(container.modelsDir)
                Scan(container.modelStore.list(), profile.memory.total, profile.modelStorageFree)
            }
        }
    }

    fun download(spec: DownloadSpec) {
        notice.value = null
        container.downloads.start(spec)
    }

    fun downloadSuggested(entry: CatalogEntry) = download(DownloadSpec.of(entry))

    fun cancel(transfer: ActiveTransfer) {
        container.downloads.cancel(transfer.spec)
        refresh()
    }

    /**
     * Copies files picked on the phone into the models folder. Several files are taken as the
     * shards of one split model. Each file is checked for the GGUF signature first, so a wrong
     * pick fails in a second instead of after copying gigabytes.
     */
    fun importFromPhone(uris: List<Uri>) {
        if (uris.isEmpty()) return
        notice.value = null
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                val resolver = context.contentResolver
                val files = uris.map { uri ->
                    runCatching { resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
                    val (name, size) = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                        if (c.moveToFirst()) (c.getString(0) ?: "model.gguf") to (if (c.isNull(1)) -1L else c.getLong(1)) else null
                    } ?: ("model.gguf" to -1L)
                    // InputStream.readNBytes needs Android 13; read the 4 signature bytes by hand.
                    val magic = runCatching {
                        resolver.openInputStream(uri)?.use { inp ->
                            val b = ByteArray(4)
                            var n = 0
                            while (n < 4) { val r = inp.read(b, n, 4 - n); if (r < 0) break; n += r }
                            if (n == 4) String(b, Charsets.US_ASCII) else null
                        }
                    }.getOrNull()
                    if (magic != "GGUF") {
                        return@withContext "«$name» مو ملف نموذج GGUF"
                    }
                    TransferFile(name, uri.toString(), size)
                }.sortedBy { it.name }
                val title = files.first().name.removeSuffix(".gguf").replace(Regex("""-\d{5}-of-\d{5}$"""), "")
                container.downloads.start(DownloadSpec(id = "phone:" + files.joinToString("|") { it.name }, title = title, files = files))
                null
            }
            notice.value = result
        }
    }

    fun run(row: InstalledRow) = container.session.load(row.model, row.title)

    fun stop() = container.session.unload()

    fun armDelete(row: InstalledRow?) {
        armed.value = row?.model?.entry?.path
    }

    fun delete(row: InstalledRow) {
        armed.value = null
        viewModelScope.launch {
            if (statusOf(row.model, container.session.state.value).first in listOf(RunStatus.LOADING, RunStatus.RUNNING)) {
                container.session.unload()
            }
            withContext(Dispatchers.IO) { row.model.shards.forEach { it.delete() } }
            refresh()
        }
    }

    fun dismissNotice() {
        notice.value = null
    }

    private fun titleOf(m: LocalModel) =
        Catalog.ownerOf(m.entry.name)?.name ?: m.summary?.name?.takeIf { it.isNotBlank() }
            ?: m.entry.name.removeSuffix(".gguf").replace(Regex("""-\d{5}-of-\d{5}$"""), "")

    private fun statusOf(m: LocalModel, s: SessionState): Pair<RunStatus, String?> = when {
        m.summary?.kind.let { it == ModelKind.VISION_PROJECTOR || it == ModelKind.OTHER } -> RunStatus.UNSUPPORTED to null
        s is SessionState.Loading && s.model.file == m.entry -> RunStatus.LOADING to null
        s is SessionState.Ready && s.model.file == m.entry -> RunStatus.RUNNING to null
        s is SessionState.Failed && s.model.file == m.entry -> RunStatus.FAILED to s.message
        else -> RunStatus.IDLE to null
    }
}
