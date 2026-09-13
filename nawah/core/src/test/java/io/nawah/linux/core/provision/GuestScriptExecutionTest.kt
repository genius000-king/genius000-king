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
 * The guest is faked around it — a stub X socket, a stub `dbus-launch`, a stub
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

    /** Stands in for the Android-side X server having bound its socket. */
    private fun socket() {
        File(root, "tmp/.X11-unix").mkdirs()
        File(root, "tmp/.X11-unix/X0").writeText("")
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
        socket()
        stub("startxfce4", "echo started; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, audio = false))

        assertThat(result.output).doesNotContain("unbound variable")
        assertThat(result.output).doesNotContain("command not found")
    }

    @Test
    fun `every shape of the session script is syntactically valid bash`() {
        for (script in listOf(
            GuestScripts.session(xfce, ResourceProfile.FULL, false),
            GuestScripts.session(cli, ResourceProfile.LIGHT, true),
            GuestScripts.session(xfce, ResourceProfile.BALANCED, true),
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
    fun `the desktop is launched once the X socket appears`() {
        socket()
        stub("startxfce4", "echo DESKTOP RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("found the X socket")
        assertThat(result.output).contains("DESKTOP RUNNING")
        assertThat(result.output).contains("session ended with status 0")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `command line only launches a terminal rather than nothing`() {
        socket()
        stub("xterm", "echo TERMINAL RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(cli, ResourceProfile.FULL, false))

        assertThat(result.output).contains("TERMINAL RUNNING")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `the desktop's exit status is propagated`() {
        socket()
        stub("startxfce4", "exit 42")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("session ended with status 42")
        assertThat(result.exitCode).isEqualTo(42)
    }

    @Test
    fun `a session with no X socket times out with an explanation`() {
        stub("startxfce4", "echo SHOULD NOT RUN; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false), timeoutSeconds = 60)

        assertThat(result.output).contains("no X socket")
        assertThat(result.output).doesNotContain("SHOULD NOT RUN")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `a missing desktop command stops the session with a clear message`() {
        socket()
        stub("dbus-launch", "shift; exec \"\$@\"")
        // startxfce4 deliberately absent.

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("startxfce4 is not installed")
        assertThat(result.exitCode).isEqualTo(1)
    }
}
