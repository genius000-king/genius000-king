package com.genius.tvhub.feature.phone.remote

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.core.model.TvEndpoint
import com.genius.tvhub.core.protocol.EditAction
import com.genius.tvhub.runtime.client.HubClient
import com.genius.tvhub.runtime.client.RemoteInput
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The remote's brain: link state in, keys out, and the keyboard that opens by itself. */
@HiltViewModel
class RemoteViewModel @Inject constructor(
    private val hub: HubClient,
    private val input: RemoteInput,
    private val settings: SettingsStore,
) : ViewModel(), RemoteActions {

    val link: StateFlow<LinkState> = hub.state
    val showHint: StateFlow<Boolean> = settings.settings.map { !it.remoteHintSeen }.stateIn(viewModelScope, SharingStarted.Eagerly, false)

    /** Non-null while the keyboard sheet is open; holds the TV field's current text. */
    private val _keyboard = MutableStateFlow<String?>(null)
    val keyboard: StateFlow<String?> = _keyboard
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message
    private var typing: Job? = null
    var onOpen: (Destination) -> Unit = {}

    init {
        viewModelScope.launch {
            input.focus.collect { f ->
                val auto = settings.current().autoKeyboard
                if (f.focused && auto && !f.password) _keyboard.value = f.text
                else if (!f.focused) _keyboard.value = null
            }
        }
    }

    override fun key(action: KeyAction) {
        viewModelScope.launch {
            runCatching { input.key(action) }.onFailure { _message.value = it.message }
            if (showHint.value) settings.update { it.copy(remoteHintSeen = true) }
        }
    }

    override fun open(destination: Destination) {
        if (destination == Destination.KEYBOARD) _keyboard.value = "" else onOpen(destination)
    }

    override fun connect(tv: TvEndpoint) = hub.connect(tv)
    override fun retry() = hub.userRetry()
    override fun manualAddress() = Unit
    override fun hintSeen() { viewModelScope.launch { settings.update { it.copy(remoteHintSeen = true) } } }

    /** Mirrors the phone field into the TV field; short debounce so fast typing is one message. */
    fun type(text: String) {
        _keyboard.value = text
        typing?.cancel()
        typing = viewModelScope.launch {
            delay(120)
            runCatching { input.text(text, TextMode.REPLACE) }.onFailure { _message.value = it.message }
        }
    }

    fun enter() { viewModelScope.launch { runCatching { input.edit(EditAction.ENTER) } } }
    fun closeKeyboard() { _keyboard.value = null }
    fun messageShown() { _message.value = null }
    fun connectManual(host: String, port: Int) = hub.connectManual(host, port)
}
