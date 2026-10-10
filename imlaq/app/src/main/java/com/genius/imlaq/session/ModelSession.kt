package com.genius.imlaq.session

import android.content.Context
import com.genius.imlaq.device.DeviceProfiler
import com.genius.imlaq.engine.EngineState
import com.genius.imlaq.engine.TextEngine
import com.genius.imlaq.engine.host.EngineService
import com.genius.imlaq.engine.host.moe.ExpertCache
import com.genius.imlaq.engine.host.moe.MoeLaunchConfig
import com.genius.imlaq.engine.host.moe.MoeTextEngine
import com.genius.imlaq.memory.MemoryPolicy
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.models.ModelKind
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File

/** The model the session is about, by the name the user sees. */
data class SessionModel(val name: String, val file: File)

sealed interface SessionState {
    data object Idle : SessionState
    data class Loading(val model: SessionModel) : SessionState
    data class Ready(val model: SessionModel) : SessionState
    data class Failed(val model: SessionModel, val message: String) : SessionState
}

/** One loaded model at a time, and the engine that runs it. */
interface ModelSession {
    val state: StateFlow<SessionState>
    val engine: TextEngine
    fun load(model: LocalModel, name: String)
    fun unload()
}

/**
 * Loads a model into the text engine with settings picked from the phone itself, and keeps the
 * app in the foreground while a model is loaded.
 *
 * The expert cache sizes itself (`--cache-mb auto`) and always leaves the phone its reserve
 * (`--cache-floor-mb`): that reserve is the "leave some RAM for the phone" rule.
 */
class EngineModelSession(
    private val context: Context,
    override val engine: MoeTextEngine,
    private val profiler: DeviceProfiler,
    private val scope: CoroutineScope,
) : ModelSession {

    private val _state = MutableStateFlow<SessionState>(SessionState.Idle)
    override val state: StateFlow<SessionState> = _state
    private var job: Job? = null

    override fun load(model: LocalModel, name: String) {
        val target = SessionModel(name, model.entry)
        if (_state.value.let { (it is SessionState.Ready || it is SessionState.Loading) && it.modelFile() == model.entry }) return
        job?.cancel()
        _state.value = SessionState.Loading(target)
        EngineService.start(context, "يجهّز $name…")
        job = scope.launch {
            val profile = profiler.profile()
            engine.launchConfig = MoeLaunchConfig(
                contextSize = 4096,
                threads = profile.performanceCores.size.coerceIn(2, 6),
                streamExperts = model.summary?.kind == ModelKind.TEXT_MOE,
                cache = ExpertCache.Auto(floor = MemoryPolicy.defaultFor(profile.memory.total).systemReserve),
            )
            engine.load(model.entry)
            when (val s = engine.state.value) {
                is EngineState.Ready -> {
                    _state.value = SessionState.Ready(target)
                    EngineService.start(context, "$name جاهز")
                }
                is EngineState.Failed -> {
                    _state.value = SessionState.Failed(target, s.message)
                    EngineService.stop(context)
                }
                else -> Unit
            }
        }
    }

    override fun unload() {
        job?.cancel()
        scope.launch {
            engine.unload()
            _state.value = SessionState.Idle
            EngineService.stop(context)
        }
    }

    private fun SessionState.modelFile(): File? = when (this) {
        is SessionState.Loading -> model.file
        is SessionState.Ready -> model.file
        is SessionState.Failed -> model.file
        SessionState.Idle -> null
    }
}
