package com.genius.imlaq.engine.host.moe

import com.genius.imlaq.engine.EngineState
import com.genius.imlaq.engine.TextEngine
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import com.genius.imlaq.engine.host.RunnerProcess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

/**
 * Text chat on BigMoeOnEdge's bmoe-cli, kept alive as one `--session` process: the model load
 * and the expert-cache warm-up are paid once, every turn after that is one JSON line on stdin.
 */
class MoeTextEngine(
    private val executable: File,
    private val libraryDir: File,
    private val workDir: File,
    private val scope: CoroutineScope,
) : TextEngine {

    override val id = "text"

    private val _state = MutableStateFlow<EngineState>(EngineState.Idle)
    override val state: StateFlow<EngineState> = _state

    /** The settings the next [load] uses. Changing them takes effect on the next load. */
    @Volatile var launchConfig = MoeLaunchConfig()

    private var process: RunnerProcess? = null
    private var reader: Job? = null
    private val lifecycle = Mutex()
    private val turns = Mutex()
    @Volatile private var turn: Channel<TextEvent>? = null
    @Volatile private var unloading = false
    @Volatile private var readyInfo: Map<String, String> = emptyMap()
    private var nextId = 1

    override suspend fun load(model: File) = lifecycle.withLock {
        stopProcess()
        unloading = false
        _state.value = EngineState.Loading()
        val p = RunnerProcess.start(BmoeArgs.build(executable, model, launchConfig), libraryDir, workDir, scope)
        process = p
        reader = scope.launch {
            for (line in p.lines) onLine(line)
            onExit(p)
        }
        // Wait for the engine's verdict on the model: READY, or an error / exit.
        _state.first { it is EngineState.Ready || it is EngineState.Failed }
        Unit
    }

    override suspend fun unload() = lifecycle.withLock { stopProcess() }

    override fun generate(request: TextRequest): Flow<TextEvent> = flow {
        turns.withLock {
            val p = process
            if (p == null || _state.value !is EngineState.Ready) {
                emit(TextEvent.Failed("no model loaded", fatal = false))
                return@withLock
            }
            if (request.images.isNotEmpty()) {
                emit(TextEvent.Failed("this engine reads text only; vision is a separate runner", fatal = false))
                return@withLock
            }
            val ch = Channel<TextEvent>(Channel.UNLIMITED)
            turn = ch
            try {
                if (!p.send(BmoeProtocol.generate(nextId++, request))) {
                    emit(TextEvent.Failed("engine is not accepting input", fatal = true))
                    return@withLock
                }
                for (e in ch) {
                    emit(e)
                    if (e is TextEvent.Finished || e is TextEvent.Failed) break
                }
            } finally {
                turn = null
            }
        }
    }

    override fun cancel() {
        val p = process ?: return
        scope.launch { p.send(BmoeProtocol.CANCEL) }
    }

    private fun onLine(line: String) {
        val event = BmoeProtocol.parser.parse(line) ?: return
        when (event.name) {
            "READY" -> {
                readyInfo = BmoeProtocol.readyInfo(event)
                _state.value = EngineState.Ready(readyInfo)
            }
            else -> for (e in BmoeProtocol.toTextEvents(event)) {
                when (e) {
                    is TextEvent.Started -> _state.value = EngineState.Busy
                    is TextEvent.Finished -> _state.value = EngineState.Ready(readyInfo)
                    // A failed turn that is not fatal leaves the model loaded and ready.
                    is TextEvent.Failed -> _state.value =
                        if (e.fatal) EngineState.Failed(e.message) else EngineState.Ready(readyInfo)
                    else -> Unit
                }
                turn?.trySend(e)
            }
        }
    }

    private suspend fun onExit(p: RunnerProcess) {
        val code = p.exitCode.await()
        if (process !== p) return
        process = null
        if (unloading) {
            _state.value = EngineState.Idle
            return
        }
        val why = "engine exited ($code): " + p.stderrTail(5).joinToString(" | ")
        turn?.trySend(TextEvent.Failed(why, fatal = true))
        _state.value = EngineState.Failed(why)
    }

    private suspend fun stopProcess() {
        val p = process ?: return
        unloading = true
        p.stop(goodbye = BmoeProtocol.CLOSE)
        reader?.join()
        process = null
        _state.value = EngineState.Idle
    }
}
