package com.genius.tvhub.engine.shell.services

import com.genius.tvhub.core.model.ServiceKind
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceState
import com.genius.tvhub.core.model.ServiceStatus
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.engine.shell.termux.CommandRunner

/**
 * Node, Python or any long-running program, kept alive in Termux by the svc.sh script. This class
 * only builds svc.sh invocations and parses their answers; [runner] executes them (Termux on the
 * TV, plain bash in tests — the same script either way).
 */
class ServiceManager(
    private val runner: CommandRunner,
    private val script: String = SCRIPT,
    private val home: String = "~/.tvhub",
) {
    /** Writes svc.sh into Termux's home. Idempotent; called before the first use per session. */
    suspend fun install() {
        val r = runner.run("mkdir -p $home && cat > $home/svc.sh <<'TVHUB_EOF'\n$script\nTVHUB_EOF\nchmod +x $home/svc.sh && echo installed", 20_000)
        if (!r.stdout.contains("installed")) throw RemoteException(ErrorCode.FAILED, "could not install svc.sh: ${r.stderr.take(200)}")
    }

    suspend fun start(spec: ServiceSpec) = expectOk(svc("start", spec.id, spec.workdir, launchCommand(spec)))

    suspend fun stop(id: String) = expectOk(svc("stop", id))

    suspend fun restart(spec: ServiceSpec) {
        stop(spec.id)
        start(spec)
    }

    suspend fun status(ids: List<String>): List<ServiceStatus> =
        if (ids.isEmpty()) emptyList() else SvcParser.status(svc("status", *ids.toTypedArray()))

    suspend fun logs(id: String, lines: Int): List<String> =
        svc("logs", id, lines.coerceIn(1, 2000).toString()).lines().dropLastWhile { it.isEmpty() }

    private suspend fun svc(vararg args: String): String =
        runner.run("bash $home/svc.sh " + args.joinToString(" ") { shellQuote(it) }, 30_000).stdout

    private fun expectOk(output: String) {
        val line = output.lines().lastOrNull { it.startsWith("ok|") || it.startsWith("err|") }
            ?: throw RemoteException(ErrorCode.FAILED, "no answer from svc.sh")
        if (line.startsWith("err|")) throw RemoteException(ErrorCode.FAILED, line.split('|').getOrElse(2) { "failed" })
    }

    companion object {
        val SCRIPT: String by lazy { ServiceManager::class.java.getResourceAsStream("/svc.sh")!!.bufferedReader().readText() }

        /** A kind gives a sensible default command when the user only picked a folder. */
        fun launchCommand(spec: ServiceSpec): String = when {
            spec.command.isNotBlank() -> spec.command
            spec.kind == ServiceKind.NODE -> "node index.js"
            spec.kind == ServiceKind.PYTHON -> "python main.py"
            else -> throw RemoteException(ErrorCode.INVALID, "a custom service needs a command")
        }

        fun shellQuote(s: String) = "'" + s.replace("'", "'\\''") + "'"
    }
}

/** svc.sh output into models. */
object SvcParser {
    fun status(output: String): List<ServiceStatus> = output.lines().mapNotNull { line ->
        val p = line.split('|')
        if (p.size < 4 || p[0] == "ok" || p[0] == "err") return@mapNotNull null
        val state = when (p[1]) {
            "running" -> ServiceState.RUNNING
            "stopped" -> ServiceState.STOPPED
            "crashed" -> ServiceState.CRASHED
            else -> ServiceState.UNKNOWN
        }
        ServiceStatus(p[0], state, p[2].toIntOrNull(), p[3].toLongOrNull())
    }
}
