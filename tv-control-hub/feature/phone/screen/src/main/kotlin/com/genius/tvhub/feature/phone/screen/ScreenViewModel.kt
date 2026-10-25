package com.genius.tvhub.feature.phone.screen

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.runtime.client.HubClient
import com.genius.tvhub.runtime.client.RemoteInput
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface ScreenStatus {
    data object Starting : ScreenStatus
    data class Playing(val width: Int, val height: Int) : ScreenStatus
    data object Failed : ScreenStatus
}

@HiltViewModel
class ScreenViewModel @Inject constructor(private val hub: HubClient, private val input: RemoteInput) : ViewModel() {
    private val _status = MutableStateFlow<ScreenStatus>(ScreenStatus.Starting)
    val status: StateFlow<ScreenStatus> = _status
    private var job: Job? = null

    /** Starts the stream into [sink] (the decoder). One stream per screen visit. */
    fun start(sink: (VideoPacket) -> Unit) {
        job?.cancel()
        _status.value = ScreenStatus.Starting
        job = viewModelScope.launch {
            runCatching {
                hub.video(StreamQuality.BALANCED).collect { p ->
                    if (p.kind == VideoPacket.Kind.FORMAT) VideoPacket.readFormat(p).let { _status.value = ScreenStatus.Playing(it[0], it[1]) }
                    sink(p)
                }
            }
            if (_status.value is ScreenStatus.Starting) _status.value = ScreenStatus.Failed
        }
    }

    fun stop() { job?.cancel(); job = null }

    fun requestKeyFrame() { viewModelScope.launch { runCatching { hub.call(Call.RequestKeyFrame) } } }
    fun tap(at: NormPoint) { viewModelScope.launch { runCatching { input.tap(at) } } }
    fun longPress(at: NormPoint) { viewModelScope.launch { runCatching { input.longPress(at) } } }
    fun swipe(points: List<NormPoint>, millis: Long) { viewModelScope.launch { runCatching { input.swipe(points, millis) } } }
    fun key(k: KeyAction) { viewModelScope.launch { runCatching { input.key(k) } } }
}
