package com.genius.imlaq.engine.host

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * One native engine running as its own process.
 *
 * Why a process and not JNI: a crash in native code kills the engine, not the app; each engine
 * links its own copy of ggml without symbol clashes; and stopping the process hands every byte
 * back to the OS at once — exactly what the memory planner needs when it evicts an engine.
 */
class RunnerProcess private constructor(
    private val process: Process,
    scope: CoroutineScope,
) {
    private val out = Channel<String>(Channel.UNLIMITED)
    private val stderr = ArrayDeque<String>()
    private val writer = process.outputStream.bufferedWriter()

    /** stdout, one line at a time, for the single adapter that owns this process. */
    val lines: ReceiveChannel<String> get() = out

    val exitCode: Deferred<Int> = scope.async(Dispatchers.IO) {
        process.inputStream.bufferedReader().useLines { seq -> seq.forEach { out.trySend(it) } }
        out.close()
        process.waitFor()
    }

    init {
        scope.launch(Dispatchers.IO) {
            process.errorStream.bufferedReader().useLines { seq ->
                seq.forEach { line ->
                    synchronized(stderr) {
                        stderr.addLast(line)
                        if (stderr.size > STDERR_LINES) stderr.removeFirst()
                    }
                }
            }
        }
    }

    /** The last lines the engine wrote to stderr — what to show when it dies. */
    fun stderrTail(n: Int = 20): List<String> = synchronized(stderr) { stderr.takeLast(n) }

    val isAlive: Boolean get() = process.isAlive

    suspend fun send(line: String): Boolean = withContext(Dispatchers.IO) {
        synchronized(writer) {
            runCatching {
                writer.write(line)
                writer.newLine()
                writer.flush()
            }.isSuccess
        }
    }

    /** Asks politely with [goodbye] (if any), then kills after [graceMs]. */
    suspend fun stop(goodbye: String? = null, graceMs: Long = 3_000) {
        if (goodbye != null) send(goodbye)
        val exited = withTimeoutOrNull(graceMs) { exitCode.await() }
        if (exited == null) {
            process.destroy()
            withContext(Dispatchers.IO) {
                if (!process.waitFor(1, TimeUnit.SECONDS)) process.destroyForcibly()
            }
        }
    }

    companion object {
        private const val STDERR_LINES = 200

        fun start(
            argv: List<String>,
            libraryDir: File,
            workDir: File,
            scope: CoroutineScope,
            env: Map<String, String> = emptyMap(),
        ): RunnerProcess {
            val pb = ProcessBuilder(argv).directory(workDir).redirectErrorStream(false)
            pb.environment()["LD_LIBRARY_PATH"] = "${libraryDir.path}:/system/lib64:/vendor/lib64"
            pb.environment().putAll(env)
            return RunnerProcess(pb.start(), scope)
        }
    }
}
