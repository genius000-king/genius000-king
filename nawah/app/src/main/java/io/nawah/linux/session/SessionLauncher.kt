package io.nawah.linux.session

import android.content.Context
import android.content.Intent
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.provision.GuestFileWriter
import io.nawah.linux.core.model.ResourceProfile
import io.nawah.linux.core.runtime.Bind
import io.nawah.linux.core.runtime.NativeTools
import io.nawah.linux.core.runtime.ProotRequest
import io.nawah.linux.core.runtime.ProotRunner
import io.nawah.linux.core.store.MachineStore
import kotlinx.coroutines.flow.Flow

/**
 * Starts a machine's graphical session.
 *
 * The two halves of the X11 bridge are started from here, and the order is
 * deliberately *not* important:
 *
 *  - [openDisplay] brings up `com.termux.x11.MainActivity`, the X server
 *    surface that ships inside the vendored :lorie library.
 *  - [sessionCommand] runs inside the container and eventually execs
 *    `/system/bin/app_process`, whose `CmdEntryPoint` re-broadcasts its Binder
 *    once a second until the activity answers.
 *
 * That retry loop is upstream's, and it is why we can fire both without
 * sequencing them. See docs/x11-bridge.md for the full handshake.
 */
class SessionLauncher(
    private val context: Context,
    private val tools: NativeTools,
    private val store: MachineStore,
    private val runner: ProotRunner,
    private val guestFiles: GuestFileWriter,
    private val desktopFor: (String) -> DesktopSpec?,
) {

    /** Brings the X display to the foreground. Safe to call when already open. */
    fun openDisplay() {
        val intent = Intent().apply {
            setClassName(context.packageName, X11_ACTIVITY)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    /**
     * Runs the machine's session script and streams its output.
     *
     * The caller is expected to be a foreground service: this flow lives for as
     * long as the desktop does, and cancelling it tears the session down.
     */
    fun start(machine: Machine): Flow<String> {
        // Rewritten every launch, never only at install time. A fix to the
        // session script must reach an existing machine through an app update,
        // not through reinstalling a gigabyte of Debian to deliver one line.
        guestFiles.refresh(machine, desktopFor(machine.desktopId))
        return runner.stream(request(machine))
    }

    internal fun request(machine: Machine): ProotRequest {
        val env = buildMap {
            put("DISPLAY", ":0")
            put("XDG_RUNTIME_DIR", "/tmp")
            put("XDG_SESSION_TYPE", "x11")
            put("NAWAH_DISPLAY_WIDTH", machine.displayWidth.toString())
            put("NAWAH_DISPLAY_HEIGHT", machine.displayHeight.toString())
            if (machine.permissions.audioOut || machine.permissions.microphone) {
                // PulseAudio runs on the Android side and is reached over
                // loopback TCP; there is no shared /run between the two worlds.
                put("PULSE_SERVER", "tcp:127.0.0.1:$PULSE_PORT")
            }
            // A profile cannot cap memory -- proot has no cgroups and that needs
            // root. What it can do is change what actually gets started, so the
            // session script reads this and turns compositing and extras off.
            put("NAWAH_PROFILE", machine.profile.name.lowercase())
        }

        return ProotRequest(
            tools = tools,
            rootfs = store.rootfsDir(machine.id),
            containerDir = store.containerDir(machine.id),
            cwd = "/root",
            hostname = machine.name.toHostname(),
            bindStorage = machine.permissions.storage,
            extraBinds = emptyList<Bind>(),
            env = env,
            command = listOf("/bin/sh", "-lc", SESSION_SCRIPT),
        )
    }

    private companion object {
        const val X11_ACTIVITY = "com.termux.x11.MainActivity"
        const val PULSE_PORT = 4713
        const val SESSION_SCRIPT = "exec /usr/local/bin/nawah-session"
    }
}

/**
 * Machine names are user-chosen and arbitrary; hostnames are not. Anything
 * outside `[A-Za-z0-9-]` becomes a hyphen, and an empty result falls back
 * rather than producing an invalid `--kernel-release` string.
 */
internal fun String.toHostname(): String =
    map { if (it.isLetterOrDigit() && it.code < 128) it else '-' }
        .joinToString("")
        .trim('-')
        .take(32)
        .ifEmpty { "nawah" }

/** Extras the session script consults; kept here so the names have one home. */
internal fun ResourceProfile.disablesCompositing(): Boolean =
    this != ResourceProfile.FULL
