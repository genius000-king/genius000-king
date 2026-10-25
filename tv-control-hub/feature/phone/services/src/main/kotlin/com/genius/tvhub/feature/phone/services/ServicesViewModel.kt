package com.genius.tvhub.feature.phone.services

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.protocol.ServiceAction
import com.genius.tvhub.core.protocol.ServiceEntry
import com.genius.tvhub.runtime.client.RemoteServices
import com.genius.tvhub.runtime.client.RemoteShell
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TerminalLine(val command: String, val result: CommandResult?)

@HiltViewModel
class ServicesViewModel @Inject constructor(private val services: RemoteServices, private val shell: RemoteShell) : ViewModel() {
    private val _list = MutableStateFlow<List<ServiceEntry>>(emptyList())
    val list: StateFlow<List<ServiceEntry>> = _list
    private val _logs = MutableStateFlow<Pair<String, List<String>>?>(null)
    val logs: StateFlow<Pair<String, List<String>>?> = _logs
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error
    private val _terminal = MutableStateFlow<List<TerminalLine>>(emptyList())
    val terminal: StateFlow<List<TerminalLine>> = _terminal

    init {
        // Status refreshes every five seconds while the page is open.
        viewModelScope.launch { while (true) { refresh(); delay(5_000) } }
    }

    private suspend fun refresh() { runCatching { services.list() }.onSuccess { _list.value = it }.onFailure { _error.value = it.message } }

    fun toggle(e: ServiceEntry, run: Boolean) = act { services.control(e.spec.id, if (run) ServiceAction.START else ServiceAction.STOP) }
    fun restart(e: ServiceEntry) = act { services.control(e.spec.id, ServiceAction.RESTART) }
    fun remove(e: ServiceEntry) = act { services.remove(e.spec.id) }
    fun save(spec: ServiceSpec) = act { services.save(spec) }
    fun openLogs(e: ServiceEntry) { viewModelScope.launch { runCatching { services.logs(e.spec.id) }.onSuccess { _logs.value = e.spec.name to it }.onFailure { _error.value = it.message } } }
    fun closeLogs() { _logs.value = null }
    fun errorShown() { _error.value = null }

    fun run(backend: ShellBackend, command: String) {
        if (command.isBlank()) return
        _terminal.value = _terminal.value + TerminalLine(command, null)
        viewModelScope.launch {
            val result = runCatching { shell.run(backend, command) }.getOrElse { CommandResult(-1, "", it.message.orEmpty(), 0, false) }
            _terminal.value = _terminal.value.dropLast(1) + TerminalLine(command, result)
        }
    }

    private fun act(block: suspend () -> Unit) {
        viewModelScope.launch { runCatching { block() }.onFailure { _error.value = it.message }; refresh() }
    }
}
