package io.nawah.linux.core.runtime

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.util.concurrent.TimeUnit

/** Runs proot and reports what it said. */
interface ProotRunner {
    /**
     * Streams combined stdout+stderr line by line. Cancelling the collector
     * destroys the process tree; `--kill-on-exit` takes the guest with it.
     */
    fun stream(request: ProotRequest): Flow<String>

    /** Runs to completion, keeping the tail of the output. */
    suspend fun run(request: ProotRequest): ProotResult

    /**
     * Streams output *and* returns the exit code.
     *
     * [stream] alone is not enough for anything that has to succeed: an early
     * version of the installer collected it and marched on, so a container that
     * never started produced a run of green ticks and a hang. Callers that need
     * the command to have worked use this and check the result.
     */
    suspend fun exec(request: ProotRequest, onLine: suspend (String) -> Unit): Int
}

class ProcessProotRunner(
    private val facts: FileSystemFacts = RealFileSystemFacts,
    private val layout: ContainerLayout = FileContainerLayout,
) : ProotRunner {

    override fun stream(request: ProotRequest): Flow<String> = callbackFlow {
        val process = start(request)
        val reader = process.inputStream.bufferedReader()
        val pump = Thread({
            try {
                reader.forEachLine { trySend(it) }
            } catch (_: Exception) {
                // Reader closed underneath us during cancellation; nothing to say.
            } finally {
                close()
            }
        }, "proot-out").apply { isDaemon = true; start() }

        awaitClose {
            process.destroy()
            if (!process.waitFor(GRACE_MS, TimeUnit.MILLISECONDS)) process.destroyForcibly()
            pump.interrupt()
        }
    }.flowOn(Dispatchers.IO)

    override suspend fun exec(
        request: ProotRequest,
        onLine: suspend (String) -> Unit,
    ): Int = withContext(Dispatchers.IO) {
        val process = start(request)
        try {
            process.inputStream.bufferedReader().use { reader ->
                while (true) {
                    val line = reader.readLine() ?: break
                    onLine(line)
                }
            }
            process.waitFor()
        } catch (e: Throwable) {
            // Includes cancellation: the process must not outlive the call.
            process.destroy()
            if (!process.waitFor(GRACE_MS, TimeUnit.MILLISECONDS)) process.destroyForcibly()
            throw e
        }
    }

    override suspend fun run(request: ProotRequest): ProotResult = withContext(Dispatchers.IO) {
        val process = start(request)
        val output = process.inputStream.bufferedReader().use { it.tail(MAX_OUTPUT_CHARS) }
        ProotResult(process.waitFor(), output)
    }

    private fun start(request: ProotRequest): Process {
        val tools = request.tools
        require(tools.missingTools().isEmpty()) {
            "native tools missing: ${tools.missingTools().joinToString()}"
        }
        request.rootfs.mkdirs()
        File(request.containerDir, ContainerDirs.TMP).mkdirs()

        return ProcessBuilder(ProotArgsBuilder.build(request, facts, layout))
            .directory(request.rootfs.parentFile ?: request.rootfs)
            .redirectErrorStream(true)
            .also { builder ->
                // Inherit nothing: a stray LD_PRELOAD from the host would be
                // handed straight to the guest.
                builder.environment().clear()
                builder.environment().putAll(ProotArgsBuilder.environment(request))
            }
            .start()
    }

    private companion object {
        const val MAX_OUTPUT_CHARS = 1 shl 20
        const val GRACE_MS = 2_000L
    }
}

/** Keeps the last [max] characters -- a failure's tail is what explains it. */
private fun BufferedReader.tail(max: Int): String {
    val sb = StringBuilder()
    forEachLine { line ->
        sb.append(line).append('\n')
        if (sb.length > max) sb.delete(0, sb.length - max)
    }
    return sb.toString()
}
