package io.nawah.linux.session

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Every display failure this project has shipped was a wrong entry in one of
 * these two lists — the argv or the environment of the X server process. They
 * are asserted here because a live `Process` cannot be.
 *
 * Each test names the device symptom it prevents.
 */
class X11LaunchPlanTest {

    @get:Rule val tmp = TemporaryFolder()

    private var seq = 0

    private fun plan(withXkb: Boolean = true, withFonts: Boolean = true): X11Launch {
        val n = seq++
        val rootfs = tmp.newFolder("rootfs-$n")
        if (withXkb) File(rootfs, "usr/share/X11/xkb").mkdirs()
        if (withFonts) {
            File(rootfs, "usr/share/fonts/X11/misc").mkdirs()
            File(rootfs, "usr/share/fonts/X11/misc/fonts.dir").writeText("0\n")
        }
        return X11LaunchPlan.build(
            apkPath = "/data/app/io.nawah.linux/base.apk",
            nativeLibDir = File("/data/app/io.nawah.linux/lib/arm64"),
            rootfs = rootfs,
            home = tmp.newFolder("home-$n"),
            display = ":0",
        )
    }

    @Test
    fun `the entry point is ours, not upstream's`() {
        // Symptom: "exited with status 134". CmdEntryPoint.main loads
        // libXlorie.so from *inside* the APK, which only works with
        // jniLibs.useLegacyPackaging false -- and we need it true, or proot is
        // never extracted and there is no Linux to display.
        assertThat(plan().command).contains("com.termux.x11.NawahEntryPoint")
        assertThat(plan().command).doesNotContain("com.termux.x11.CmdEntryPoint")
    }

    @Test
    fun `the X server library is passed as an absolute path on disk`() {
        val env = plan().environment

        assertThat(env["NAWAH_XLORIE"])
            .isEqualTo("/data/app/io.nawah.linux/lib/arm64/libXlorie.so")
        assertThat(env["NAWAH_XLORIE"]).doesNotContain("base.apk!")
    }

    @Test
    fun `TMPDIR is the guest's own tmp, so the socket needs no bind`() {
        // Symptom: the session script waits 20s for /tmp/.X11-unix/X0 and
        // times out. The server writes into <rootfs>/tmp, which *is* the
        // container's /tmp -- put it anywhere else and the two never meet.
        val p = plan()
        val tmpdir = File(p.environment.getValue("TMPDIR"))

        assertThat(tmpdir.name).isEqualTo("tmp")
        assertThat(tmpdir.parentFile!!.name).startsWith("rootfs")
        assertThat(p.socketDir).isEqualTo(File(tmpdir, ".X11-unix"))
        assertThat(p.socket(":0").name).isEqualTo("X0")
    }

    @Test
    fun `the keyboard map is found inside the machine`() {
        // Symptom: the server prints "$XKB_CONFIG_ROOT is not set" and quits,
        // which reaches the user as a black screen. dirname(TMPDIR) is how
        // upstream finds it, and it only lands on the rootfs because of the
        // TMPDIR choice above.
        assertThat(plan().environment["XKB_CONFIG_ROOT"]).endsWith("/usr/share/X11/xkb")
    }

    @Test
    fun `a machine with no keyboard map is reported rather than guessed at`() {
        assertThat(plan(withXkb = false).environment).doesNotContainKey("XKB_CONFIG_ROOT")
    }

    @Test
    fun `CLASSPATH is our own APK, so no loader needs installing in the guest`() {
        assertThat(plan().environment["CLASSPATH"])
            .isEqualTo("/data/app/io.nawah.linux/base.apk")
    }

    @Test
    fun `the display argument is passed through to the server`() {
        val command = plan().command
        assertThat(command.first()).isEqualTo("/system/bin/app_process")
        assertThat(command).contains(":0")
        assertThat(command.indexOf("com.termux.x11.NawahEntryPoint"))
            .isLessThan(command.indexOf(":0"))
    }

    @Test
    fun `the font path is named explicitly rather than left to the server's search`() {
        // Symptom: "Fatal server error: could not open default font". The
        // server looks at <root>/etc/X11/fonts first, which on Debian exists
        // and holds only alias sources -- so its search succeeds and yields a
        // font path with nothing readable in it.
        val command = plan().command
        val fp = command.indexOf("-fp")

        assertThat(fp).isGreaterThan(0)
        assertThat(command[fp + 1]).endsWith("/usr/share/fonts/X11/misc")
    }

    @Test
    fun `a machine with no usable fonts is not given a font path it cannot read`() {
        assertThat(plan(withFonts = false).command).doesNotContain("-fp")
    }

    @Test
    fun `a non-zero display resolves to its own socket`() {
        val p = X11LaunchPlan.build(
            apkPath = "/base.apk",
            nativeLibDir = File("/lib"),
            rootfs = tmp.newFolder("r2"),
            home = tmp.newFolder("h2"),
            display = ":3",
        )
        assertThat(p.socket(":3").name).isEqualTo("X3")
    }
}
