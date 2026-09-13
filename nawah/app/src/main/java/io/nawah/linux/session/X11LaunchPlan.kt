package io.nawah.linux.session

import io.nawah.linux.core.provision.GuestPrerequisites
import java.io.File

/**
 * The exact argv and environment the X server process is started with.
 *
 * Pulled out of [X11Bridge] because every mistake this project has made with
 * the display server was a mistake in *these two lists*, and a list is testable
 * while a live `Process` is not.
 */
internal data class X11Launch(
    val command: List<String>,
    val environment: Map<String, String>,
    /** Directory the X socket will appear in, host-side. */
    val socketDir: File,
) {
    /** Full path of the display socket, e.g. `<rootfs>/tmp/.X11-unix/X0`. */
    fun socket(display: String): File = File(socketDir, "X" + displayNumber(display))

    /**
     * Everything a previous run may have left behind for [display].
     *
     * All three are fatal to the next launch in their own way, and none of
     * them is cleaned up when the server is killed rather than asked to quit —
     * which is exactly how a session ends:
     *
     *  - the socket file: `connect()` on it returns ECONNREFUSED, which is what
     *    an X client reports as "Connection refused" while the file is plainly
     *    there.
     *  - `.X<n>-lock`: holds the old pid. `LockServer` calls `kill(pid, 0)`, and
     *    on Android that pid has very likely been reused by an unrelated
     *    process — so the server concludes the display is taken and aborts with
     *    "Server is already active for display <n>".
     *  - `.tX<n>-lock`: the temporary the lock is renamed from. Left in place it
     *    costs three `open(O_EXCL)` failures at `sleep(2)` apiece before the
     *    server even tries again.
     */
    /**
     * `:0` and `:0.0` are the same display; the trailing `.0` is a screen.
     * Neither the socket nor the lock file ever carries it.
     */
    private fun displayNumber(display: String): String =
        display.removePrefix(":").substringBefore('.')

    fun staleFiles(display: String): List<File> {
        val n = displayNumber(display)
        return listOf(
            socket(display),
            File(socketDir.parentFile, ".X$n-lock"),
            File(socketDir.parentFile, ".tX$n-lock"),
        )
    }
}

internal object X11LaunchPlan {

    const val APP_PROCESS: String = "/system/bin/app_process"
    const val ENTRY_POINT: String = "com.termux.x11.NawahEntryPoint"
    const val LIBRARY: String = "libXlorie.so"

    /**
     * Builds the launch for [display].
     *
     * ### Why `TMPDIR` is the guest's own `/tmp` and not a scratch directory
     * The X server derives two things from `dirname($TMPDIR)`, and calls that
     * directory the container root (`cmdentrypoint.cpp`, "chroot case"):
     *
     *  - `XKB_CONFIG_ROOT` — `<root>/usr/share/X11/xkb`. Without it the server
     *    refuses to start at all: *"$XKB_CONFIG_ROOT is not set"*.
     *  - the default font path — `<root>/usr/share/fonts/X11`.
     *
     * Pointing `TMPDIR` at `<rootfs>/tmp` therefore does two jobs at once: the
     * socket lands where the container already sees it as `/tmp`, and the
     * keyboard map is found. Pointing it anywhere else costs an explicit bind
     * *and* breaks the keymap lookup. The font path is not left to that search
     * at all — see below.
     */
    fun build(
        apkPath: String,
        nativeLibDir: File,
        rootfs: File,
        home: File,
        display: String,
    ): X11Launch {
        val tmp = File(rootfs, "tmp")
        val env = buildMap {
            // Our own APK: com.termux.x11 is compiled into it, so there is no
            // loader.apk to ship and no signing certificate to verify.
            put("CLASSPATH", apkPath)
            put("TMPDIR", tmp.absolutePath)
            put("LD_LIBRARY_PATH", nativeLibDir.absolutePath)
            put("HOME", home.absolutePath)
            // The library is already extracted on disk; see NawahEntryPoint for
            // why it is not loaded from inside the APK.
            put("NAWAH_XLORIE", File(nativeLibDir, LIBRARY).absolutePath)
            val xkb = File(rootfs, "usr/share/X11/xkb")
            if (xkb.isDirectory) put("XKB_CONFIG_ROOT", xkb.absolutePath)
        }

        // -fp is passed rather than left to the server's own search, which
        // looks at <root>/etc/X11/fonts first. On Debian that directory exists
        // and holds only alias *sources* -- no fonts.dir, no usable font -- so
        // the search succeeds, the font path is unusable, and the server dies
        // with "could not open default font". Naming the real directories, and
        // only the ones that carry a fonts.dir, removes the guess.
        val fontPath = GuestPrerequisites.fontPath(rootfs)

        return X11Launch(
            command = buildList {
                add(APP_PROCESS)
                add("-Xnoimage-dex2oat")
                add("/")
                add("--nice-name=nawah-x11")
                add(ENTRY_POINT)
                add(display)
                if (fontPath != null) {
                    add("-fp")
                    add(fontPath)
                }
            },
            environment = env,
            socketDir = File(tmp, ".X11-unix"),
        )
    }
}
