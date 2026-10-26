package com.genius.tvhub.engine.shell.sandbox

import com.genius.tvhub.core.model.CommandResult
import java.io.File
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Runs a command with this app's own permissions (Android's toybox: ls, cat, ps of our UID, ping…).
 * Output is capped so a runaway command cannot exhaust the TV's memory; a timeout kills it.
 */
class SandboxShell(private val workdir: File, private val shell: String = "/system/bin/sh") {

    fun run(command: String, timeoutMillis: Long, env: Map<String, String> = emptyMap()): CommandResult {
        val started = System.currentTimeMillis()
        val process = ProcessBuilder(shell, "-c", command).directory(workdir).apply { environment().putAll(env) }.start()
        process.outputStream.close()
        val out = Capture(process.inputStream)
        val err = Capture(process.errorStream)
        val finished = process.waitFor(timeoutMillis, TimeUnit.MILLISECONDS)
        if (!finished) process.destroyForcibly()
        out.join(); err.join()
        val exit = if (finished) process.exitValue() else 124
        val stderr = if (finished) err.text else (err.text + "\n[stopped after ${timeoutMillis / 1000}s]").trim()
        return CommandResult(exit, out.text, stderr, System.currentTimeMillis() - started, out.truncated || err.truncated)
    }

    private class Capture(stream: InputStream) {
        private val buf = java.io.ByteArrayOutputStream()
        @Volatile var truncated = false
        private val reader = thread(isDaemon = true) {
            val chunk = ByteArray(8192)
            stream.use {
                while (true) {
                    val n = it.read(chunk)
                    if (n < 0) break
                    if (buf.size() < MAX_OUTPUT) buf.write(chunk, 0, minOf(n, MAX_OUTPUT - buf.size())) else truncated = true
                }
            }
        }
        fun join() = reader.join(2_000)
        val text: String get() = buf.toString("UTF-8") // toString(Charset) is Android 13+
    }

    companion object {
        const val MAX_OUTPUT = 512 * 1024
    }
}
