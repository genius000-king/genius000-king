package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.PeerInfo
import com.genius.tvhub.core.protocol.Push
import com.genius.tvhub.core.transport.CallHandler
import com.genius.tvhub.core.transport.RpcServer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

/**
 * One phone's control connection: the channel pushes travel on. It owns the live metrics
 * subscription and forwards keyboard focus; calls themselves are answered by the handler.
 */
class HostSession(
    val peer: PeerInfo,
    private val rpc: RpcServer,
    private val ports: HostPorts,
    private val grants: () -> Grants,
) {
    private var scope: CoroutineScope? = null
    private var metricsJob: Job? = null

    suspend fun run(handler: CallHandler) = coroutineScope {
        scope = this
        launch {
            // Skip the current value: only real focus changes open or close the phone keyboard.
            ports.input.focusedField.drop(1).collect { f ->
                if (Grant.INPUT in grants()) rpc.push(Push.TextFocus(f != null, f?.text.orEmpty(), f?.hint, f?.password ?: false))
            }
        }
        rpc.run(handler)
        cancel()
    }

    fun watchMetrics(on: Boolean) {
        metricsJob?.cancel()
        metricsJob = if (on) scope?.launch { ports.monitor.metrics().collect { rpc.push(Push.Metrics(it)) } } else null
    }

    suspend fun push(push: Push) = rpc.push(push)
}
