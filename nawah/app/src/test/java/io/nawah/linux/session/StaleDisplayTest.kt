package io.nawah.linux.session

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * What a previous session leaves behind, and why each piece is fatal.
 *
 * The device symptom was the clearest one this project has produced and the
 * easiest to misread: it worked the first time, and never again until the app
 * was reinstalled. Nothing in the code was random — the first launch simply ran
 * on a clean `/tmp` and every later one did not.
 */
class StaleDisplayTest {

    @get:Rule val tmp = TemporaryFolder()

    private fun launch(display: String = ":0"): X11Launch {
        val rootfs = tmp.newFolder("rootfs-${System.nanoTime()}")
        File(rootfs, "usr/share/X11/xkb").mkdirs()
        return X11LaunchPlan.build(
            apkPath = "/base.apk",
            nativeLibDir = File("/lib"),
            rootfs = rootfs,
            home = tmp.newFolder("home-${System.nanoTime()}"),
            display = display,
        )
    }

    @Test
    fun `all three leftovers of a killed server are named`() {
        val names = launch().staleFiles(":0").map { it.name }

        // The socket: connect() returns ECONNREFUSED, which an X client reports
        // as "Connection refused" about a path that is plainly there.
        // .X0-lock: holds a dead pid, and LockServer's kill(pid, 0) cannot tell
        // a reused Android pid from the original -- "Server is already active".
        // .tX0-lock: three open(O_EXCL) failures at sleep(2) each before the
        // server even retries.
        assertThat(names).containsExactly("X0", ".X0-lock", ".tX0-lock")
    }

    @Test
    fun `the leftovers sit beside the socket directory, not inside it`() {
        val plan = launch()
        val (socket, lock, tempLock) = plan.staleFiles(":0")

        assertThat(socket.parentFile).isEqualTo(plan.socketDir)
        assertThat(lock.parentFile).isEqualTo(plan.socketDir.parentFile)
        assertThat(tempLock.parentFile).isEqualTo(plan.socketDir.parentFile)
    }

    @Test
    fun `a different display number gets its own lock files`() {
        assertThat(launch(":3").staleFiles(":3").map { it.name })
            .containsExactly("X3", ".X3-lock", ".tX3-lock")
    }

    @Test
    fun `a screen suffix does not leak into the lock file name`() {
        // DISPLAY may legitimately be ":0.0"; the lock is still .X0-lock.
        assertThat(launch(":0").staleFiles(":0.0").map { it.name })
            .containsExactly("X0", ".X0-lock", ".tX0-lock")
    }
}
