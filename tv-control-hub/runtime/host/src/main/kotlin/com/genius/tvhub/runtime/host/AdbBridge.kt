package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.engine.adb.AndroidAdbEngine
import com.genius.tvhub.engine.adb.api.AdbState
import com.genius.tvhub.engine.adb.api.AgentInput
import com.genius.tvhub.engine.adb.setup.StepId
import com.genius.tvhub.engine.apps.AndroidAppsEngine
import com.genius.tvhub.engine.input.AccessibilityInputEngine
import com.genius.tvhub.engine.input.api.RawInput
import com.genius.tvhub.engine.stream.quality.StreamPlanner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Plugs ADB mode into the other engines while it is connected: real input for the input engine,
 * silent installs for the apps engine, and the screen for the live view. The engines never see
 * each other; only this adapter knows all of them.
 */
@Singleton
class AdbBridge @Inject constructor(
    val adb: AndroidAdbEngine,
    private val input: AccessibilityInputEngine,
    private val apps: AndroidAppsEngine,
    private val settings: SettingsStore,
) {
    val state: StateFlow<AdbState> = adb.state
    private val _failedSteps = MutableStateFlow<List<StepId>>(emptyList())
    /** Setup steps that did not apply on the last connect (empty = all good). */
    val failedSteps: StateFlow<List<StepId>> = _failedSteps
    val ready get() = adb.state.value == AdbState.Ready

    private var started = false

    fun start(scope: CoroutineScope) {
        if (started) return
        started = true
        scope.launch {
            // Reconnect at every start once the user has set ADB mode up.
            if (settings.current().adbMode) adb.connect()
            adb.state.map { it == AdbState.Ready }.distinctUntilChanged().collect { ready ->
                if (ready) onReady() else onLost()
            }
        }
    }

    /** User asked for ADB mode (TV settings). Remembered, so later starts reconnect by themselves. */
    fun enable() {
        adb.connect()
    }

    fun disable(scope: CoroutineScope) {
        adb.disconnect()
        scope.launch { settings.update { it.copy(adbMode = false) } }
    }

    private suspend fun onReady() {
        settings.update { it.copy(adbMode = true) }
        input.attachRawInput(RawAgent(adb.input))
        apps.silentInstaller = { files -> adb.install(files) }
        // Idempotent: also heals an accessibility service Android switched off after an update.
        _failedSteps.value = adb.setup(takeHome = settings.current().launcherTakesHome)
        Log.i(TAG, "ADB mode ready; setup failures: ${_failedSteps.value}")
    }

    private fun onLost() {
        input.attachRawInput(null)
        apps.silentInstaller = null
    }

    /** The live screen through screenrecord, in the same packets the projection path sends. */
    fun packets(displayWidth: Int, displayHeight: Int, quality: StreamQuality): Flow<VideoPacket> = flow {
        val f = StreamPlanner.plan(displayWidth, displayHeight, quality)
        emit(VideoPacket.format(f.width, f.height, f.fps, f.bitrate))
        val t0 = System.nanoTime()
        adb.screen(f.width, f.height, f.bitrate).collect { u ->
            val pts = (System.nanoTime() - t0) / 1_000
            emit(
                if (u.config) VideoPacket(VideoPacket.Kind.CONFIG, 0, pts, u.data)
                else VideoPacket(VideoPacket.Kind.FRAME, if (u.keyFrame) VideoPacket.FLAG_KEY else 0, pts, u.data),
            )
        }
    }

    private class RawAgent(private val agent: AgentInput) : RawInput {
        override val ready = agent.ready
        override suspend fun key(keyCode: Int, longPress: Boolean) = agent.key(keyCode, longPress)
        override suspend fun text(text: String) = agent.text(text)
        override suspend fun tap(x: Float, y: Float, longPress: Boolean) = agent.tap(x, y, longPress)
        override suspend fun swipe(points: List<Pair<Float, Float>>, durationMillis: Long) = agent.swipe(points, durationMillis)
    }

    private companion object { const val TAG = "AdbBridge" }
}
