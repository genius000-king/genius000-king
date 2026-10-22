package com.tvhub.app.mobile.ui.stream

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tvhub.common.AppResult
import com.tvhub.input.VideoPoint
import com.tvhub.protocol.CONTROL_PORT
import com.tvhub.protocol.GlobalAction
import com.tvhub.protocol.IceCandidate
import com.tvhub.protocol.NavAction
import com.tvhub.protocol.ProtocolMessage
import com.tvhub.protocol.SdpOffer
import com.tvhub.protocol.Tap
import com.tvhub.stream.mobile.ViewerPeer
import com.tvhub.transport.mobile.ControlClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

/** Connection state of the live-screen page. */
sealed interface ConnectionStatus {
    data object Idle : ConnectionStatus

    data object Connecting : ConnectionStatus

    data object Connected : ConnectionStatus

    data class Failed(val reason: String) : ConnectionStatus
}

/**
 * Connects to the TV, relays WebRTC signalling to [viewer], and sends taps and navigation keys back.
 * The control client lives as long as the page does, so a rotation keeps the connection.
 */
class StreamViewModel(application: Application) : AndroidViewModel(application) {

    private val client = ControlClient(viewModelScope, peerId = "phone-${UUID.randomUUID().toString().take(8)}")

    val viewer = ViewerPeer(application) { message -> send(message) }

    private val _status = MutableStateFlow<ConnectionStatus>(ConnectionStatus.Idle)
    val status: StateFlow<ConnectionStatus> = _status.asStateFlow()

    fun connect(host: String, port: Int = CONTROL_PORT) {
        viewModelScope.launch {
            _status.value = ConnectionStatus.Connecting
            when (val result = client.connect(host, port)) {
                is AppResult.Success -> {
                    _status.value = ConnectionStatus.Connected
                    client.incoming.collect { handle(it) }
                }
                is AppResult.Failure -> _status.value = ConnectionStatus.Failed(result.error.message)
            }
        }
    }

    fun tap(point: VideoPoint) {
        send(Tap(x = point.x, y = point.y))
    }

    fun navigate(action: NavAction) {
        send(GlobalAction(action))
    }

    override fun onCleared() {
        client.release()
        viewer.release()
        super.onCleared()
    }

    private fun handle(message: ProtocolMessage) {
        when (message) {
            is SdpOffer -> viewer.onOffer(message.sdp)
            is IceCandidate -> viewer.onRemoteCandidate(message)
            else -> Unit
        }
    }

    private fun send(message: ProtocolMessage) {
        viewModelScope.launch { client.send(message) }
    }
}
