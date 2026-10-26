package com.genius.tvhub.engine.adb.agent

import com.genius.tvhub.core.common.Log
import com.genius.tvhub.engine.adb.api.AgentInput
import dadb.AdbStream
import dadb.Dadb
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Starts [ShellAgent] over ADB and talks to it. One command at a time (input order matters);
 * if the agent dies, the next command starts it again.
 */
internal class AgentClient(
    private val apkPath: String,
    private val screen: () -> Pair<Int, Int>,
    private val dadb: () -> Dadb?,
) : AgentInput {
    private val lock = Mutex()
    private var stream: AdbStream? = null
    /** Answers, read by a thread of their own: a blocking socket read can't be cancelled by a timeout. */
    private var answers = LinkedBlockingQueue<String>()
    private val _ready = MutableStateFlow(false)
    override val ready: StateFlow<Boolean> = _ready

    override suspend fun key(keyCode: Int, longPress: Boolean) = send(AgentCommand.Key(keyCode, longPress))
    override suspend fun text(text: String) = send(AgentCommand.Text(text))
    override suspend fun tap(x: Float, y: Float, longPress: Boolean) = send(AgentCommand.Tap(x, y, longPress))
    override suspend fun swipe(points: List<Pair<Float, Float>>, durationMillis: Long) = send(AgentCommand.Swipe(points, durationMillis))

    /** Starts the agent now, so the first key press is not the slow one. */
    suspend fun warmUp() = send(AgentCommand.Ping)

    fun stop() {
        runCatching { stream?.close() }
        stream = null
        _ready.value = false
    }

    private suspend fun send(cmd: AgentCommand): Boolean = lock.withLock {
        withContext(Dispatchers.IO) {
            repeat(2) { attempt ->
                val s = stream ?: start() ?: return@withContext false
                answers.clear()
                val answer = runCatching {
                    s.sink.writeUtf8(AgentProtocol.encode(cmd)).writeUtf8("\n").flush()
                    answers.poll(ANSWER_MILLIS + ((cmd as? AgentCommand.Swipe)?.durationMillis ?: 0), TimeUnit.MILLISECONDS)?.startsWith(AgentProtocol.OK)
                }.getOrNull()
                if (answer != null) return@withContext answer
                Log.w(TAG, "agent did not answer (attempt ${attempt + 1}); restarting it")
                stop()
            }
            false
        }
    }

    private fun start(): AdbStream? {
        val d = dadb() ?: return null
        val (w, h) = screen()
        val s = runCatching {
            d.open("exec:CLASSPATH=$apkPath app_process /system/bin ${ShellAgent::class.java.name} $w $h")
        }.getOrElse { Log.w(TAG, "could not start the agent", it); return null }
        val queue = LinkedBlockingQueue<String>()
        thread(name = "adb-agent-reader", isDaemon = true) {
            runCatching {
                while (true) {
                    val line = s.source.readUtf8LineStrict()
                    // Skip anything app_process prints that is not ours.
                    if (line.startsWith("@@")) queue.put(line)
                }
            }
        }
        val line = queue.poll(START_MILLIS, TimeUnit.MILLISECONDS)
        if (line?.startsWith(AgentProtocol.READY) != true) {
            Log.w(TAG, "agent failed to start: $line")
            runCatching { s.close() }
            return null
        }
        answers = queue
        stream = s
        _ready.value = true
        return s
    }

    private companion object {
        const val TAG = "AdbAgent"
        const val ANSWER_MILLIS = 3_000L
        const val START_MILLIS = 8_000L
    }
}
