package com.genius.tvhub.feature.phone.apps

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.model.AppInfo
import com.genius.tvhub.engine.apps.beam.BeamableApp
import com.genius.tvhub.engine.apps.beam.PhoneApkSource
import com.genius.tvhub.runtime.client.RemoteApps
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

sealed interface Beam {
    data class Sending(val label: String, val progress: Float) : Beam
    data class Confirm(val label: String) : Beam
    data class Done(val label: String) : Beam
    data class Failed(val reason: String) : Beam
}

@HiltViewModel
class AppsViewModel @Inject constructor(@ApplicationContext private val context: Context, private val remote: RemoteApps) : ViewModel() {
    private val _tvApps = MutableStateFlow<List<AppInfo>>(emptyList())
    val tvApps: StateFlow<List<AppInfo>> = _tvApps
    private val _icons = MutableStateFlow<Map<String, ImageBitmap>>(emptyMap())
    val icons: StateFlow<Map<String, ImageBitmap>> = _icons
    private val _phoneApps = MutableStateFlow<List<BeamableApp>?>(null)
    val phoneApps: StateFlow<List<BeamableApp>?> = _phoneApps
    private val _beam = MutableStateFlow<Beam?>(null)
    val beam: StateFlow<Beam?> = _beam

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            val apps = runCatching { remote.list() }.getOrDefault(emptyList())
            _tvApps.value = apps
            // Icons come one by one so the grid fills in instead of waiting for all of them.
            apps.forEach { app ->
                if (app.packageName in _icons.value) return@forEach
                runCatching { remote.icon(app.packageName, 128) }.getOrNull()?.let { png ->
                    BitmapFactory.decodeByteArray(png, 0, png.size)?.let { _icons.value = _icons.value + (app.packageName to it.asImageBitmap()) }
                }
            }
        }
    }

    fun launch(app: AppInfo) { viewModelScope.launch { runCatching { remote.launch(app.packageName) } } }
    fun uninstall(app: AppInfo) { viewModelScope.launch { runCatching { remote.uninstall(app.packageName) } } }

    fun openBeam() { viewModelScope.launch { _phoneApps.value = withContext(Dispatchers.IO) { PhoneApkSource(context).apps() } } }
    fun closeBeam() { _phoneApps.value = null }

    /** Streams the app's APKs (base + splits) to the TV, then waits for the TV to confirm. */
    fun send(app: BeamableApp) {
        _phoneApps.value = null
        viewModelScope.launch(Dispatchers.IO) {
            _beam.value = Beam.Sending(app.label, 0f)
            runCatching {
                remote.install(app.label, app.files.map { f -> f.length() to { f.inputStream() } }) { p ->
                    _beam.value = if (p >= 1f) Beam.Confirm(app.label) else Beam.Sending(app.label, p)
                }
            }.onSuccess { _beam.value = Beam.Done(app.label); refresh() }
                .onFailure { _beam.value = Beam.Failed(it.message ?: "error") }
        }
    }

    fun dismissBeam() { _beam.value = null }
}
