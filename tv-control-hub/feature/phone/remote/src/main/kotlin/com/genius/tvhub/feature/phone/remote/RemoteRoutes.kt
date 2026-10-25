package com.genius.tvhub.feature.phone.remote

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.runtime.client.RemoteInput
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The phone's home: the living remote, with the keyboard sheet that opens by itself. */
@Composable
fun RemoteRoute(onOpen: (Destination) -> Unit, vm: RemoteViewModel = hiltViewModel()) {
    vm.onOpen = onOpen
    val link by vm.link.collectAsStateWithLifecycle()
    val hint by vm.showHint.collectAsStateWithLifecycle()
    val keyboard by vm.keyboard.collectAsStateWithLifecycle()
    RemoteScreen(link, vm, hint)
    keyboard?.let { KeyboardSheet(it, vm::type, vm::enter, vm::closeKeyboard) }
}

@HiltViewModel
class MouseViewModel @Inject constructor(private val input: RemoteInput) : ViewModel() {
    fun move(dx: Float, dy: Float) { viewModelScope.launch { input.move(dx, dy) } }
    fun click(long: Boolean) { viewModelScope.launch { runCatching { input.click(long) } } }
    fun scroll(dx: Float, dy: Float) { viewModelScope.launch { input.scroll(dx, dy) } }
    fun pointer(visible: Boolean) { viewModelScope.launch { runCatching { input.pointer(visible) } } }
}

@Composable
fun MouseRoute(onBack: () -> Unit, vm: MouseViewModel = hiltViewModel()) {
    androidx.compose.runtime.DisposableEffect(Unit) {
        vm.pointer(true)
        onDispose { }
    }
    MouseScreen(vm::move, vm::click, vm::scroll, onBack)
}
