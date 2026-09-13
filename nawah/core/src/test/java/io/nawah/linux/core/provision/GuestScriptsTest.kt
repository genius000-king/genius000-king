package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.ResourceProfile
import org.junit.Test

/**
 * The session script is the only thing the app writes inside the guest, and
 * every line of it is load-bearing: a broken one shows up as "the desktop just
 * doesn't appear" with nothing useful in any log.
 */
class GuestScriptsTest {

    private val xfce = DesktopSpec("xfce4", "XFCE 4", listOf("xfce4"), "startxfce4", 1)

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
    fun `the session does not try to start the X server itself`() {
        // The correction that cost several releases: the server runs on the
        // Android side, and the container only consumes its socket. Starting an
        // Android runtime under proot exits instantly with status 0.
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).doesNotContain("app_process")
        assertThat(script).doesNotContain("nawah-x11")
    }

    @Test
    fun `the session waits for the shared X socket and explains a timeout`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("/tmp/.X11-unix/X0")
        assertThat(script).contains("Android-side display server did not come up")
    }

    @Test
    fun `a missing desktop command is named rather than left to fail obscurely`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("startxfce4 is not installed")
        assertThat(script).contains("dbus-x11")
    }

    @Test
    fun `the session reports how it ended`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("session ended with status")
    }

    @Test
    fun `session waits for the X socket rather than racing it`() {
        assertThat(GuestScripts.session(xfce, ResourceProfile.FULL, false))
            .contains("/tmp/.X11-unix/X0")
    }
}
