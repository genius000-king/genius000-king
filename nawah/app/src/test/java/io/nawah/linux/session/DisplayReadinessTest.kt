package io.nawah.linux.session

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Existence is not readiness.
 *
 * `File.exists()` returns true for a socket left by a killed server, and
 * `connect()` to that same file fails with ECONNREFUSED. The launch used the
 * first check, declared the display ready in milliseconds, and started a
 * desktop against nothing.
 *
 * [SocketProbe] is an interface so this distinction can be tested without an
 * Android runtime — the distinction is what was wrong, not the syscall.
 */
class DisplayReadinessTest {

    @get:Rule val tmp = TemporaryFolder()

    private fun socket(): File = tmp.newFile("X0").apply { writeText("") }

    /** The state a killed server leaves: the file is there, nothing answers. */
    private val dead = SocketProbe { false }

    private val live = SocketProbe { it.exists() }

    private fun ready(socket: File, probe: SocketProbe) = socket.exists() && probe.isListening(socket)

    @Test
    fun `a leftover socket file is not a ready display`() {
        assertThat(ready(socket(), dead)).isFalse()
    }

    @Test
    fun `a socket that answers is a ready display`() {
        assertThat(ready(socket(), live)).isTrue()
    }

    @Test
    fun `a missing socket is never probed`() {
        var probed = false
        val counting = SocketProbe { probed = true; true }

        assertThat(ready(File(tmp.root, "absent"), counting)).isFalse()
        assertThat(probed).isFalse()
    }

    @Test
    fun `a display that comes up late is still caught`() {
        // The server takes seconds: xkb compilation, the font path scan, and
        // possibly the lock retry. Readiness has to be polled, not sampled.
        val file = socket()
        var attempts = 0
        val slow = SocketProbe { attempts++ >= 3 }

        val seen = (1..10).firstOrNull { ready(file, slow) } != null

        assertThat(seen).isTrue()
        assertThat(attempts).isAtLeast(4)
    }
}
