package io.nawah.linux.session

import android.content.Context
import android.util.Log
import io.nawah.linux.core.runtime.NativeTools
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * The X server, started on the Android side of the container.
 *
 * This is the correction to the mistake that cost several releases. The bridge
 * was being started *inside* proot, and it exited immediately with status 0 —
 * a success that had done nothing. Upstream's own README is explicit about
 * where it belongs:
 *
 *   > Example, run in a Termux shell (not inside the proot container):
 *   >   termux-x11 :1 &
 *   >   proot-distro login ubuntu --shared-tmp
 *
 * The X server runs outside; the container finds the socket because both sides
 * are looking at the same directory on disk. Ours is simpler than Termux's: the
 * server writes into `<rootfs>/tmp`, which *is* the container's `/tmp`, so no
 * bind is involved at all.
 *
 * Running an Android runtime under proot's ptrace was never the design.
 */
class X11Bridge(
    private val context: Context,
    private val tools: NativeTools,
) {

    private var process: Process? = null
    private var launch: X11Launch? = null

    /** True while the X server process is alive. */
    val isRunning: Boolean get() = process?.isAlive == true

    /**
     * Starts the X server for [display], with its socket inside [rootfs]`/tmp`.
     *
     * @param onLine receives the server's own output, which is the only place
     *   a failure to load the native library or to reach the activity shows up.
     */
    fun start(rootfs: File, display: String, onLine: (String) -> Unit): Boolean {
        stop()

        val plan = X11LaunchPlan.build(
            apkPath = context.applicationInfo.sourceDir,
            nativeLibDir = tools.nativeLibDir,
            rootfs = rootfs,
            home = context.filesDir,
            display = display,
        )
        plan.socketDir.mkdirs()

        if (!File(X11LaunchPlan.APP_PROCESS).canExecute()) {
            onLine("nawah: ${X11LaunchPlan.APP_PROCESS} is missing; this device cannot run the display server")
            return false
        }
        val library = plan.environment.getValue("NAWAH_XLORIE")
        if (!File(library).isFile) {
            onLine("nawah: $library was not unpacked; the APK is missing its X server library")
            return false
        }
        if (!plan.environment.containsKey("XKB_CONFIG_ROOT")) {
            // Not fatal here — the server has its own fallbacks — but this is
            // the exact shape of the failure the user sees as a black screen,
            // so it is said out loud rather than left in logcat.
            onLine("nawah: no keyboard map in the machine (usr/share/X11/xkb); install the xkb-data package")
        }

        val started = runCatching {
            ProcessBuilder(plan.command)
                .redirectErrorStream(true)
                .also { builder ->
                    builder.environment().apply {
                        remove("LD_PRELOAD")
                        putAll(plan.environment)
                    }
                }
                .start()
        }.getOrElse {
            onLine("nawah: could not start the display server: ${it.message}")
            return false
        }

        process = started
        launch = plan
        Thread({
            runCatching {
                started.inputStream.bufferedReader().forEachLine { onLine("x11: $it") }
            }
            val status = runCatching { started.waitFor() }.getOrDefault(-1)
            onLine("nawah: the display server exited with status $status")
            if (status == 134) {
                onLine("nawah: status 134 means libXlorie.so could not be loaded — see docs/x11-bridge.md")
            }
        }, "nawah-x11-out").apply { isDaemon = true }.start()

        return true
    }

    /** Waits for the X socket to appear. Returns false on timeout or early exit. */
    fun awaitSocket(display: String, timeoutMs: Long = 20_000): Boolean {
        val socket = launch?.socket(display) ?: return false
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (socket.exists()) return true
            if (process?.isAlive == false) return false
            Thread.sleep(POLL_MS)
        }
        return socket.exists()
    }

    fun stop() {
        process?.let { p ->
            p.destroy()
            if (!p.waitFor(2, TimeUnit.SECONDS)) p.destroyForcibly()
            Log.i(TAG, "display server stopped")
        }
        process = null
        launch = null
    }

    private companion object {
        const val TAG = "NawahX11"
        const val POLL_MS = 150L
    }
}
