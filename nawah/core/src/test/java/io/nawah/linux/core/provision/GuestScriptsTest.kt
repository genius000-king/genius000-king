package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.LocalizedText
import io.nawah.linux.core.model.ResourceProfile
import org.junit.Test

/**
 * The session script is the only thing the app writes inside the guest, and
 * every line of it is load-bearing: a broken one shows up as "the desktop just
 * doesn't appear" with nothing useful in any log.
 */
class GuestScriptsTest {

    private val xfce = DesktopSpec("xfce4", LocalizedText.of("XFCE 4"), listOf("xfce4"), "startxfce4", 1)

    @Test
    fun `session exports DISPLAY`() {
        assertThat(GuestScripts.session(xfce, ResourceProfile.FULL, audio = false))
            .contains("export DISPLAY=:0")
    }

    @Test
    fun `the audio server is started inside the machine, where the clients are`() {
        // The previous arrangement pointed clients at a TCP port on the Android
        // side that nothing had ever listened on. The server lives in the guest
        // now and its clients reach it the ordinary way.
        val on = GuestScripts.session(xfce, ResourceProfile.FULL, audio = true)
        assertThat(on).contains("pulseaudio --daemonize=no")
        assertThat(on).contains(GuestScripts.PULSE_CONFIG_PATH)
        assertThat(on).doesNotContain("export PULSE_SERVER")

        val off = GuestScripts.session(xfce, ResourceProfile.FULL, audio = false)
        assertThat(off).doesNotContain("pulseaudio")
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
        val none = DesktopSpec("none", LocalizedText.of("None"), emptyList(), "", 0)
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
    fun `the session waits for a display that answers, not for a file`() {
        // A killed server leaves its socket file behind. Waiting on the file
        // succeeded instantly against that leftover, the desktop launched
        // against nothing, and every client said "Connection refused" -- which
        // is how this worked exactly once per install.
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("xset -q")
        assertThat(script).contains("Android-side display server did not come up")
    }

    @Test
    fun `a leftover socket is named as a leftover, not as a missing server`() {
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("exists but the display refuses connections")
        assertThat(script).contains("left by an earlier session")
    }

    @Test
    fun `dbus is given a runtime directory it will accept`() {
        // dbus: XDG_RUNTIME_DIR "/tmp" can be written by others (mode 041777)
        val script = GuestScripts.session(xfce, ResourceProfile.FULL, false)

        assertThat(script).contains("export XDG_RUNTIME_DIR=/run/user/0")
        assertThat(script).contains("mkdir -p -m 700")
        assertThat(script).doesNotContain("XDG_RUNTIME_DIR=/tmp")
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
    fun `the socket path the guest watches is the one the server binds`() {
        assertThat(GuestScripts.session(xfce, ResourceProfile.FULL, false))
            .contains(GuestScripts.X_SOCKET)
    }
}
