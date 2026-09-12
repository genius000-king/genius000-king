package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.ResourceProfile
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Runs the generated scripts in a real bash instead of reading them.
 *
 * The tests next door assert that the script *contains* certain text. That is
 * not the same as the script working, and the difference reached a device:
 * a leftover `${NAWAH_START%% *}` under `set -u` killed every session at line
 * 19, while every string assertion stayed green. A script is a program; the
 * only test that means anything is running it.
 *
 * The guest is faked around it — a stub bridge, a stub `app_process`, a stub
 * desktop command — so each failure path can be forced deliberately.
 */
class GuestScriptExecutionTest {

    @get:Rule val tmp = TemporaryFolder()

    private val xfce = DesktopSpec("xfce4", "XFCE 4", listOf("xfce4"), "startxfce4", 1)
    private val cli = DesktopSpec("none", "Command line only", emptyList(), "", 0)

    private lateinit var root: File
    private lateinit var bin: File

    @Before
    fun setUp() {
        assumeTrue("bash is required", File("/bin/bash").canExecute())
        root = tmp.newFolder("guest")
        bin = File(root, "bin").apply { mkdirs() }
        File(root, "tmp").mkdirs()
    }

    /** A fake executable on PATH that does whatever the body says. */
    private fun stub(name: String, body: String) {
        File(bin, name).apply {
            writeText("#!/bin/bash\n$body\n")
            setExecutable(true)
        }
    }

    private class Run(val exitCode: Int, val output: String)

    /**
     * Executes [script] with the fakes on PATH.
     *
     * `NAWAH_TEST_ROOT` stands in for `/`, so the script's absolute paths are
     * rewritten to point inside the sandbox rather than at the host.
     */
    private fun run(script: String, timeoutSeconds: Long = 30): Run {
        val rewritten = script
            .replace("/usr/local/bin/", "${root.path}/bin/")
            .replace("/usr/bin/nawah-x11", "${root.path}/bin/nawah-x11")
            .replace("/usr/libexec/nawah-x11/loader.apk", "${root.path}/loader.apk")
            .replace("/system/bin/app_process", "${root.path}/bin/app_process")
            .replace("/tmp/.X11-unix", "${root.path}/tmp/.X11-unix")
            .replace("chmod 1777 ${root.path}/tmp ", "chmod 1777 ")

        val file = File(root, "session.sh").apply {
            writeText(rewritten)
            setExecutable(true)
        }

        val process = ProcessBuilder("/bin/bash", file.path)
            .directory(root)
            .redirectErrorStream(true)
            .also {
                it.environment()["PATH"] = "${bin.path}:/usr/bin:/bin"
                it.environment()["HOME"] = root.path
            }
            .start()

        val output = process.inputStream.bufferedReader().readText()
        val finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS)
        if (!finished) {
            process.destroyForcibly()
            return Run(-1, output)
        }
        return Run(process.exitValue(), output)
    }

    // -- the bug that got through --------------------------------------------

    @Test
    fun `the session script runs without an unbound variable`() {
        // The regression this whole file exists for. `set -u` plus a variable
        // nobody defines is invisible to a `contains` assertion and fatal at
        // run time.
        File(root, "loader.apk").writeText("dex")
        stub("nawah-x11", "sleep 5")
        stub("app_process", "exit 0")
        stub("startxfce4", "echo started; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, audio = false))

        assertThat(result.output).doesNotContain("unbound variable")
        assertThat(result.output).doesNotContain("command not found")
    }

    @Test
    fun `both scripts are syntactically valid bash`() {
        for (script in listOf(
            GuestScripts.session(xfce, ResourceProfile.FULL, false),
            GuestScripts.session(cli, ResourceProfile.LIGHT, true),
            GuestScripts.bridge("io.nawah.linux"),
        )) {
            val file = tmp.newFile("check-${System.nanoTime()}.sh").apply { writeText(script) }
            val check = ProcessBuilder("/bin/bash", "-n", file.path)
                .redirectErrorStream(true).start()
            val out = check.inputStream.bufferedReader().readText()
            check.waitFor()
            assertThat(out).isEmpty()
            assertThat(check.exitValue()).isEqualTo(0)
        }
    }

    // -- the failure paths, each forced on purpose ---------------------------

    @Test
    fun `a missing loader is reported and X is not started`() {
        stub("nawah-x11", "echo BRIDGE STARTED; sleep 5")
        stub("app_process", "exit 0")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("MISSING")
        assertThat(result.output).contains("preflight failed")
        assertThat(result.output).doesNotContain("BRIDGE STARTED")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `a container without app_process says so in words`() {
        File(root, "loader.apk").writeText("dex")
        stub("nawah-x11", "sleep 5")
        // app_process deliberately absent: this is the missing-bind-mount case.

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("app_process is not visible")
        assertThat(result.output).contains("bind mounts are missing")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `a bridge that dies immediately is reported, not waited out`() {
        File(root, "loader.apk").writeText("dex")
        stub("nawah-x11", "echo bridge failing; exit 3")
        stub("app_process", "exit 0")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false), timeoutSeconds = 20)

        assertThat(result.output).contains("display bridge exited before X came up")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `the desktop is launched once the X socket appears`() {
        File(root, "loader.apk").writeText("dex")
        // The bridge creates the socket the way the real X server does.
        stub("nawah-x11", "mkdir -p ${'$'}HOME/tmp/.X11-unix; : > ${'$'}HOME/tmp/.X11-unix/X0; sleep 5")
        stub("app_process", "exit 0")
        stub("startxfce4", "echo DESKTOP RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("X is up")
        assertThat(result.output).contains("DESKTOP RUNNING")
        assertThat(result.output).contains("session ended with status 0")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `command line only launches a terminal rather than nothing`() {
        File(root, "loader.apk").writeText("dex")
        stub("nawah-x11", "mkdir -p ${'$'}HOME/tmp/.X11-unix; : > ${'$'}HOME/tmp/.X11-unix/X0; sleep 5")
        stub("app_process", "exit 0")
        stub("xterm", "echo TERMINAL RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(cli, ResourceProfile.FULL, false))

        assertThat(result.output).contains("TERMINAL RUNNING")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `the desktop's exit status is propagated`() {
        File(root, "loader.apk").writeText("dex")
        stub("nawah-x11", "mkdir -p ${'$'}HOME/tmp/.X11-unix; : > ${'$'}HOME/tmp/.X11-unix/X0; sleep 5")
        stub("app_process", "exit 0")
        stub("startxfce4", "exit 42")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("session ended with status 42")
        assertThat(result.exitCode).isEqualTo(42)
    }

    @Test
    fun `the bridge script refuses to run without app_process`() {
        val script = GuestScripts.bridge("io.nawah.linux")
            .replace("/system/bin/app_process", "${root.path}/bin/app_process")
        val file = File(root, "bridge.sh").apply { writeText(script); setExecutable(true) }

        val process = ProcessBuilder("/bin/bash", file.path)
            .redirectErrorStream(true).start()
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()

        assertThat(output).contains("app_process is not visible")
        assertThat(process.exitValue()).isEqualTo(1)
    }
}
