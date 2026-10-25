package com.genius.tvhub.engine.shell

import com.genius.tvhub.core.model.ServiceKind
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceState
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.engine.shell.sandbox.SandboxShell
import com.genius.tvhub.engine.shell.services.ServiceManager
import com.genius.tvhub.engine.shell.services.SvcParser
import com.genius.tvhub.engine.shell.termux.CommandRunner
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class SandboxShellTest {
    @get:Rule val tmp = TemporaryFolder()
    private val shell by lazy { SandboxShell(tmp.root, shell = "/bin/sh") }

    @Test fun capturesOutputAndExitCode() {
        val r = shell.run("echo hi; echo oops >&2; exit 3", 5_000)
        assertThat(r.stdout.trim()).isEqualTo("hi")
        assertThat(r.stderr.trim()).isEqualTo("oops")
        assertThat(r.exitCode).isEqualTo(3)
    }

    @Test fun timeoutKills() {
        val r = shell.run("sleep 10", 300)
        assertThat(r.exitCode).isEqualTo(124)
        assertThat(r.stderr).contains("stopped after")
        assertThat(r.durationMillis).isLessThan(5_000)
    }

    @Test fun outputIsCapped() {
        val r = shell.run("yes aaaaaaaaaaaaaaaa | head -c 2000000", 10_000)
        assertThat(r.truncated).isTrue()
        assertThat(r.stdout.length).isAtMost(SandboxShell.MAX_OUTPUT)
    }
}

/**
 * The real svc.sh, run by real bash against a real process: what Termux does on the TV.
 * TVHUB_HOME points into a temp folder.
 */
class ServiceManagerTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun manager(): ServiceManager {
        val home = File(tmp.root, "svc").absolutePath
        val sandbox = SandboxShell(tmp.root, shell = "/bin/bash")
        val runner = CommandRunner { cmd, timeout -> sandbox.run(cmd, timeout, mapOf("TVHUB_HOME" to home)) }
        return ServiceManager(runner, home = home)
    }

    @Test fun startStatusLogsStop() = runBlocking {
        val m = manager()
        m.install()
        val work = tmp.newFolder("app")
        File(work, "server.sh").writeText("echo started; while true; do sleep 0.2; done")
        m.start(ServiceSpec("web", "Web", ServiceKind.CUSTOM, work.absolutePath, "bash server.sh"))
        val running = m.status(listOf("web")).single()
        assertThat(running.state).isEqualTo(ServiceState.RUNNING)
        assertThat(running.pid).isNotNull()
        assertThat(m.logs("web", 50).joinToString("\n")).contains("started")

        m.stop("web")
        assertThat(m.status(listOf("web")).single().state).isEqualTo(ServiceState.STOPPED)
        assertThat(File("/proc/${running.pid}").exists()).isFalse()
    }

    @Test fun crashIsReported() = runBlocking {
        val m = manager()
        m.install()
        val work = tmp.newFolder("bad")
        m.start(ServiceSpec("bad", "Bad", ServiceKind.CUSTOM, work.absolutePath, "sleep 1; exit 1"))
        Thread.sleep(1_600)
        assertThat(m.status(listOf("bad")).single().state).isEqualTo(ServiceState.CRASHED)
    }

    @Test fun errorsAreTyped() = runBlocking {
        val m = manager()
        m.install()
        val e = runCatching { m.start(ServiceSpec("x", "X", ServiceKind.CUSTOM, "/no/such/dir", "true")) }.exceptionOrNull()
        assertThat(e).isInstanceOf(RemoteException::class.java)
        assertThat(e!!.message).contains("no such folder")
        // A name carrying shell syntax is refused by svc.sh before anything runs.
        assertThat(runCatching { m.stop("x; echo pwned") }.exceptionOrNull()).isInstanceOf(RemoteException::class.java)
    }

    @Test fun parserAndQuoting() {
        val s = SvcParser.status("a|running|42|7\nb|stopped||\nok|x|y\ngarbage")
        assertThat(s.map { it.id to it.state }).containsExactly("a" to ServiceState.RUNNING, "b" to ServiceState.STOPPED).inOrder()
        assertThat(s.first().uptimeSeconds).isEqualTo(7)
        assertThat(ServiceManager.shellQuote("it's")).isEqualTo("'it'\\''s'")
        assertThat(ServiceManager.launchCommand(ServiceSpec("n", "n", ServiceKind.NODE, "~", ""))).isEqualTo("node index.js")
    }
}
