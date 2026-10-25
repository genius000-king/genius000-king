package com.genius.tvhub.feature.phone.files

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.FileRoot
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.runtime.client.RemoteFiles
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject

data class FilesState(
    val roots: List<FileRoot> = emptyList(),
    val dir: RemotePath? = null,
    val entries: List<FileEntry> = emptyList(),
    val progress: Float? = null,
    val message: String? = null,
)

@HiltViewModel
class FilesViewModel @Inject constructor(@ApplicationContext private val context: Context, private val files: RemoteFiles) : ViewModel() {
    private val _state = MutableStateFlow(FilesState())
    val state: StateFlow<FilesState> = _state

    init {
        viewModelScope.launch {
            runCatching { files.roots() }.onSuccess { roots ->
                _state.value = _state.value.copy(roots = roots)
                roots.firstOrNull()?.let { open(RemotePath(it.id)) }
            }.onFailure(::report)
        }
    }

    fun open(dir: RemotePath) {
        viewModelScope.launch {
            runCatching { files.list(dir) }.onSuccess { _state.value = _state.value.copy(dir = dir, entries = it) }.onFailure(::report)
        }
    }

    /** Back goes up a folder; returns false at a root so the page can close. */
    fun up(): Boolean {
        val parent = _state.value.dir?.parent() ?: return false
        open(parent); return true
    }

    fun upload(uri: Uri) {
        val dir = _state.value.dir ?: return
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val (name, size) = describe(uri)
                context.contentResolver.openInputStream(uri)!!.let { input ->
                    files.upload(input, size, dir.child(name)) { _state.value = _state.value.copy(progress = it) }
                }
            }.onFailure(::report)
            _state.value = _state.value.copy(progress = null)
            open(dir)
        }
    }

    fun download(entry: FileEntry) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                files.download(entry.path, openDownload(entry.name, entry.mime)) { _state.value = _state.value.copy(progress = it) }
                _state.value = _state.value.copy(message = context.getString(R.string.files_saved))
            }.onFailure(::report)
            _state.value = _state.value.copy(progress = null)
        }
    }

    fun rename(entry: FileEntry, name: String) = mutate { files.rename(entry.path, name) }
    fun delete(entry: FileEntry) = mutate { files.delete(listOf(entry.path)) }
    fun mkdir(name: String) = _state.value.dir?.let { d -> mutate { files.mkdir(d.child(name)) } }
    fun messageShown() { _state.value = _state.value.copy(message = null) }

    private fun mutate(block: suspend () -> Unit) {
        viewModelScope.launch {
            runCatching { block() }.onFailure(::report)
            _state.value.dir?.let(::open)
        }
    }

    private fun report(e: Throwable) { _state.value = _state.value.copy(message = e.message) }

    private fun describe(uri: Uri): Pair<String, Long> {
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val name = c.getString(c.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))
                val size = c.getLong(c.getColumnIndexOrThrow(OpenableColumns.SIZE))
                return name to size
            }
        }
        return (uri.lastPathSegment ?: "file") to -1L
    }

    /** Downloads go to the phone's Downloads folder (MediaStore on Android 10+). */
    private fun openDownload(name: String, mime: String?): java.io.OutputStream {
        return if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime ?: "application/octet-stream")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/TV Hub")
            }
            val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)!!
            context.contentResolver.openOutputStream(uri)!!
        } else {
            FileOutputStream(File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), name))
        }
    }
}
