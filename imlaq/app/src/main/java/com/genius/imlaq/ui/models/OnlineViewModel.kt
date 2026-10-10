package com.genius.imlaq.ui.models

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.imlaq.models.ModelTypes
import com.genius.imlaq.models.download.DownloadSpec
import com.genius.imlaq.models.hub.DirectLink
import com.genius.imlaq.models.hub.HubModelFile
import com.genius.imlaq.models.hub.HubRepo
import com.genius.imlaq.models.hub.HuggingFace
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class OnlineUiState(
    val query: String = "",
    val searching: Boolean = false,
    val results: List<HubRepo>? = null,
    /** The repo whose files are open, and its files once listed. */
    val repo: HubRepo? = null,
    val files: List<HubModelFile>? = null,
    val link: String = "",
    val checkingLink: Boolean = false,
    val error: String? = null,
)

/** Finding a model on the internet: a Hugging Face search, or a direct link from any site. */
class OnlineViewModel(
    private val hub: HuggingFace,
    private val startDownload: (DownloadSpec) -> Unit,
) : ViewModel() {

    private val _state = MutableStateFlow(OnlineUiState())
    val state: StateFlow<OnlineUiState> = _state
    private var job: Job? = null

    fun onQuery(q: String) = _state.update { it.copy(query = q) }
    fun onLink(l: String) = _state.update { it.copy(link = l, error = null) }

    fun search() {
        val q = _state.value.query.trim()
        if (q.isEmpty()) return
        job?.cancel()
        _state.update { it.copy(searching = true, error = null, repo = null, files = null) }
        job = viewModelScope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { hub.search(q) } }
            _state.update {
                it.copy(searching = false, results = r.getOrNull(), error = r.exceptionOrNull()?.message)
            }
        }
    }

    fun open(repo: HubRepo) {
        job?.cancel()
        _state.update { it.copy(repo = repo, files = null, error = null) }
        job = viewModelScope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { hub.files(repo.id, repo.type) } }
            _state.update { it.copy(files = r.getOrNull() ?: emptyList(), error = r.exceptionOrNull()?.message) }
        }
    }

    fun closeRepo() = _state.update { it.copy(repo = null, files = null, error = null) }

    fun download(file: HubModelFile) = startDownload(file.toSpec())

    /** Checks a pasted link (name and size) and starts it. Returns through [onStarted]. */
    fun downloadLink(onStarted: () -> Unit) {
        val link = _state.value.link.trim()
        if (link.isEmpty()) return
        _state.update { it.copy(checkingLink = true, error = null) }
        viewModelScope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { DirectLink.inspect(link) } }
            val file = r.getOrNull()
            if (file != null) {
                val title = file.name.removeSuffix(".gguf")
                startDownload(DownloadSpec("url:" + file.source, title, listOf(file), ModelTypes.fromHub(null, emptyList(), file.source + " " + title)))
                _state.update { it.copy(checkingLink = false, link = "") }
                onStarted()
            } else {
                _state.update { it.copy(checkingLink = false, error = r.exceptionOrNull()?.message ?: "الرابط ما اشتغل") }
            }
        }
    }
}
