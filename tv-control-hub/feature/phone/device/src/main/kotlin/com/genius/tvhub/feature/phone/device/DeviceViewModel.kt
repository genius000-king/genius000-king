package com.genius.tvhub.feature.phone.device

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.runtime.client.RemoteDevice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DeviceState(
    val profile: DeviceProfile? = null,
    val now: MetricsSnapshot? = null,
    /** Last minute of memory use (0..1) and download rate, newest last. */
    val memoryHistory: List<Float> = emptyList(),
    val rxHistory: List<Float> = emptyList(),
)

@HiltViewModel
class DeviceViewModel @Inject constructor(private val device: RemoteDevice) : ViewModel() {
    private val _state = MutableStateFlow(DeviceState())
    val state: StateFlow<DeviceState> = _state

    init {
        viewModelScope.launch { runCatching { device.profile() }.onSuccess { p -> _state.value = _state.value.copy(profile = p) } }
        viewModelScope.launch {
            runCatching {
                device.metrics().collect { m ->
                    val s = _state.value
                    _state.value = s.copy(
                        now = m,
                        memoryHistory = (s.memoryHistory + m.memory.usedFraction).takeLast(60),
                        rxHistory = (s.rxHistory + m.network.rxBytesPerSec.toFloat()).takeLast(60),
                    )
                }
            }
        }
    }
}
