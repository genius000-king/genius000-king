package com.tvhub.app.tv.hub

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** What the TV is doing right now. Shown on the lab screen. */
data class HubStatus(
    val address: String? = null,
    val isServing: Boolean = false,
    val isStreaming: Boolean = false,
    val viewers: Int = 0,
    val lastEvent: String = "",
)

/** The single source of truth the service writes to and the UI reads from. */
object HubStatusStore {
    private val _state = MutableStateFlow(HubStatus())
    val state: StateFlow<HubStatus> = _state.asStateFlow()

    fun update(transform: (HubStatus) -> HubStatus) {
        _state.update(transform)
    }
}
