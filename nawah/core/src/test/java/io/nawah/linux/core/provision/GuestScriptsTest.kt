package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.ResourceProfile
import org.junit.Test

/**
 * The bridge script is the guest half of the X11 handshake. Every line in it
 * is load-bearing, and a broken one shows up as "the desktop just doesn't
 * appear" with nothing useful in any log.
 */
class GuestScriptsTest {

    private val xfce = DesktopSpec("xfce4", "XFCE 4", listOf("xfce4"), "startxfce4", 1)

    @Test
    fun `bridge points CLASSPATH at the loader we install`() {
        val s = GuestScripts.bridge("io.nawah.linux")
        assertThat(s).contains("export CLASSPATH=${GuestScripts.LOADER_PATH}")
    }

    @Test
    fun `bridge clears the loader variables before handing over to app_process`() {
        // app_process is Android's own launcher; a stray LD_PRELOAD from the
        // guest would be inherited straight into it.
        val s = GuestScripts.bridge("io.nawah.linux")
        assertThat(s).contains("unset LD_LIBRARY_PATH LD_PRELOAD")
        assertThat(s.indexOf("unset LD_LIBRARY_PATH"))
            .isLessThan(s.indexOf("exec /system/bin/app_process"))
    }

    @Test
    fun `bridge preserves the caller's variables under XSTARTUP names`() {
        val s = GuestScripts.bridge("io.nawah.linux")
        assertThat(s).contains("XSTARTUP_LD_LIBRARY_PATH")
        assertThat(s).contains("XSTARTUP_LD_PRELOAD")
        assertThat(s).contains("XSTARTUP_CLASSPATH")
    }

    @Test
    fun `bridge invokes the upstream loader class`() {
        assertThat(GuestScripts.bridge("io.nawah.linux")).contains("com.termux.x11.Loader")
    }

    @Test
    fun `bridge fails loudly when app_process is not visible`() {
        // This is the symptom of a missing --bind=/system, and the message is
        // the only thing standing between a user and an hour of confusion.
        val s = GuestScripts.bridge("io.nawah.linux")
        assertThat(s).contains("/system/bin/app_process")
        assertThat(s).contains("exit 1")
    }

    @Test
    fun `bridge carries the host application id`() {
        assertThat(GuestScripts.bridge("com.example.other")).contains("com.example.other")
    }

    @Test
    fun `session starts the bridge before the desktop`() {
        val s = GuestScripts.session(xfce, ResourceProfile.BALANCED, audio = true)
        assertThat(s.indexOf(GuestScripts.BRIDGE_PATH))
            .isLessThan(s.indexOf("startxfce4"))
    }

    @Test
    fun `session exports DISPLAY`() {
        assertThat(GuestScripts.session(xfce, ResourceProfile.FULL, audio = false))
            .contains("export DISPLAY=:0")
    }

    @Test
    fun `audio is reached over loopback TCP, since there is no shared socket`() {
        val on = GuestScripts.session(xfce, ResourceProfile.FULL, audio = true)
        assertThat(on).contains("PULSE_SERVER")
        assertThat(on).contains("tcp:127.0.0.1:4713")

        val off = GuestScripts.session(xfce, ResourceProfile.FULL, audio = false)
        assertThat(off).doesNotContain("PULSE_SERVER")
    }

    @Test
    fun `non-full profiles turn compositing off, which is a real memory saving`() {
        assertThat(GuestScripts.session(xfce, ResourceProfile.LIGHT, false))
            .contains("use_compositing")
        assertThat(GuestScripts.session(xfce, ResourceProfile.FULL, false))
            .doesNotContain("use_compositing")
    }

    @Test
    fun `a desktop with no start command still gets a visible client`() {
        // "Command line only" used to start a login shell with no terminal, so
        // X came up with nothing drawn on it: a black screen and no explanation.
        val none = DesktopSpec("none", "None", emptyList(), "", 0)
        val script = GuestScripts.session(none, ResourceProfile.FULL, false)

        assertThat(script).contains("xterm")
        assertThat(script).doesNotContain("dbus-launch --exit-with-session \n")
    }

    @Test
    fun `the session refuses to start X when app_process is not reachable`() {
        // The single most confusing failure in the project: without the Android
        // system bind mounts the bridge cannot run, and the only symptom is a
        // black rectangle. The script now says so in words.
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("/system/bin/app_process")
        assertThat(script).contains("preflight failed, not starting X")
    }

    @Test
    fun `the session checks the bridge and loader are actually installed`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains(GuestScripts.BRIDGE_PATH)
        assertThat(script).contains(GuestScripts.LOADER_PATH)
        assertThat(script).contains("MISSING")
    }

    @Test
    fun `a bridge that dies early is reported rather than waited out`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("the display bridge exited before X came up")
        assertThat(script).contains("X socket never appeared")
    }

    @Test
    fun `the session reports how it ended`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("session ended with status")
    }

    @Test
    fun `the X socket directory is created with the right permissions`() {
        // xtrans refuses a world-writable directory without the sticky bit.
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("chmod 1777 /tmp /tmp/.X11-unix")
    }

    @Test
    fun `session waits for the X socket rather than racing it`() {
        assertThat(GuestScripts.session(xfce, ResourceProfile.FULL, false))
            .contains("/tmp/.X11-unix/X0")
    }
}
