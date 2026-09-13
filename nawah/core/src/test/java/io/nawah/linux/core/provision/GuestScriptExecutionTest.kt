package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.LocalizedText
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

    private val xfce = DesktopSpec("xfce4", LocalizedText.of("XFCE 4"), listOf("xfce4"), "startxfce4", 1)
    private val cli = DesktopSpec("none", LocalizedText.of("Command line only"), emptyList(), "", 0)

    private lateinit var root: File
    private lateinit var bin: File

    @Before
    fun setUp() {
        assumeTrue("bash is required", File("/bin/bash").canExecute())
        root = tmp.newFolder("guest")
        bin = File(root, "bin").apply { mkdirs() }
        File(root, "tmp").mkdirs()
    }

    /** Stands in for a *live* Android-side X server: socket bound and answering. */
    private fun socket() {
        socketFile()
        stub("xset", "exit 0")
    }

    /** The socket file alone — what a killed server leaves behind. */
    private fun socketFile() {
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
            .replace("/run/user/0", "${root.path}/run/user/0")
            .replace("/etc/pulse/nawah.pa", "${root.path}/etc/pulse/nawah.pa")
            .replace("/tmp/nawah-pulse.log", "${root.path}/nawah-pulse.log")
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
    fun `the desktop is launched once the display answers`() {
        socket()
        stub("startxfce4", "echo DESKTOP RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("the display is answering on :0")
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
    fun `a session with no display at all times out with an explanation`() {
        stub("xset", "exit 1")
        stub("startxfce4", "echo SHOULD NOT RUN; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false), timeoutSeconds = 90)

        assertThat(result.output).contains("no X display on :0")
        assertThat(result.output).doesNotContain("SHOULD NOT RUN")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `a socket left by an earlier session does not count as a display`() {
        // The device bug, reproduced. The session ends by killing the server,
        // which unlinks nothing; the next launch found the leftover file,
        // declared the display ready in milliseconds and started the desktop
        // against it. Every X client then said "Connection refused" about a
        // path that was obviously there. It worked exactly once per install.
        socketFile()
        stub("xset", "exit 1")
        stub("startxfce4", "echo SHOULD NOT RUN; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false), timeoutSeconds = 90)

        assertThat(result.output).contains("refuses connections")
        assertThat(result.output).contains("left by an earlier session")
        assertThat(result.output).doesNotContain("SHOULD NOT RUN")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `a machine without xset still starts, falling back to the file`() {
        // x11-xserver-utils has been in the base set from the first release, so
        // this is the unlikely path -- but falling back is better than refusing
        // to start a desktop that would have worked.
        socketFile()
        stub("startxfce4", "echo DESKTOP RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("DESKTOP RUNNING")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `the audio server is started and reported when sound is on`() {
        socket()
        // pactl fails until pulseaudio has run, the way it does on a real
        // machine -- otherwise the script only ever sees "already running".
        stub("pulseaudio", "touch \"${root.path}/pulse-up\"; sleep 5")
        stub("pactl", "[ -e \"${root.path}/pulse-up\" ]")
        stub("startxfce4", "exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, audio = true))

        assertThat(result.output).contains("audio server started")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `a machine with no audio server says so instead of being silently mute`() {
        // pulseaudio deliberately absent. The desktop must still start.
        socket()
        stub("startxfce4", "echo DESKTOP RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, audio = true))

        assertThat(result.output).contains("pulseaudio is not installed")
        assertThat(result.output).contains("DESKTOP RUNNING")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `an audio server that refuses to start never blocks the desktop`() {
        // Sound is worth less than a desktop. This used to be the difference
        // between a working session and a black screen.
        socket()
        stub("pulseaudio", "exit 1")
        stub("pactl", "exit 1")
        stub("startxfce4", "echo DESKTOP RUNNING; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, audio = true), timeoutSeconds = 60)

        assertThat(result.output).contains("the audio server did not start")
        assertThat(result.output).contains("DESKTOP RUNNING")
        assertThat(result.exitCode).isEqualTo(0)
    }

    @Test
    fun `PULSE_SERVER is never exported, because nothing ever listened there`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, audio = true)

        assertThat(script).doesNotContain("export PULSE_SERVER")
        assertThat(script).doesNotContain("tcp:127.0.0.1:4713")
    }

    @Test
    fun `dbus gets a private runtime directory, not world-writable tmp`() {
        socket()
        stub("startxfce4", "echo \"RUNTIME=\$XDG_RUNTIME_DIR\"; stat -c %a \"\$XDG_RUNTIME_DIR\"; exit 0")
        stub("dbus-launch", "shift; exec \"\$@\"")

        val result = run(GuestScripts.session(xfce, ResourceProfile.FULL, false))

        assertThat(result.output).contains("/run/user/0")
        assertThat(result.output).contains("700")
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
