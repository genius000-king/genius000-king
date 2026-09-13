package io.nawah.linux.session

import android.content.Context
import android.content.Intent
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.model.ResourceProfile
import io.nawah.linux.core.provision.DisplayPrerequisites
import io.nawah.linux.core.provision.GuestFileWriter
import io.nawah.linux.core.provision.GuestScripts
import io.nawah.linux.core.runtime.Bind
import io.nawah.linux.core.runtime.NativeTools
import io.nawah.linux.core.runtime.ProotRequest
import io.nawah.linux.core.runtime.ProotRunner
import io.nawah.linux.core.store.MachineStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.ProducerScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Starts a machine's graphical session.
 *
 * Three things have to happen, and unlike the earlier design the order *is*
 * important:
 *
 *  1. [X11Bridge] starts the X server **outside** the container, writing its
 *     socket into `<rootfs>/tmp/.X11-unix/X0` — which the guest already sees
 *     as `/tmp/.X11-unix/X0`, no bind required.
 *  2. The container starts and its session script waits for that socket before
 *     launching a single X client.
 *  3. [openDisplay] brings up `com.termux.x11.MainActivity`, the surface the
 *     server draws into. This one genuinely needs no sequencing: the server
 *     re-broadcasts its Binder once a second until the activity answers.
 *
 * Before any of it, the machine is checked for the two packages the X server
 * cannot start without; a machine installed by an older build gets them here
 * rather than being told to reinstall Debian.
 *
 * See docs/x11-bridge.md for the full handshake and for the three ways this
 * was got wrong before.
 */
class SessionLauncher(
    private val context: Context,
    private val tools: NativeTools,
    private val store: MachineStore,
    private val runner: ProotRunner,
    private val guestFiles: GuestFileWriter,
    private val desktopFor: (String) -> DesktopSpec?,
) {

    private val bridge = X11Bridge(context, tools)

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
    fun start(machine: Machine): Flow<String> = channelFlow {
        // Rewritten every launch, never only at install time. A fix to the
        // session script must reach an existing machine through an app update,
        // not through reinstalling a gigabyte of Debian to deliver one line.
        guestFiles.refresh(machine, desktopFor(machine.desktopId))

        val rootfs = store.rootfsDir(machine.id)

        // A machine installed by an older build can be missing a package the
        // display server cannot start without. The answer to that is not
        // "reinstall Debian"; it is eight megabytes and one apt run, once.
        if (!installMissingPrerequisites(rootfs, machine)) return@channelFlow

        // The X server first, on this side of the container. Its output is
        // merged into the same log: when the desktop does not appear, the
        // reason is almost always in these lines.
        send("nawah: starting the display server")
        val started = bridge.start(rootfs, DISPLAY) { line ->
            trySend(line)
        }
        if (!started) {
            send("nawah: the display server could not be started")
            return@channelFlow
        }
        if (!withContext(Dispatchers.IO) { bridge.awaitSocket(DISPLAY) }) {
            send("nawah: the display server did not create its socket")
            bridge.stop()
            return@channelFlow
        }
        send("nawah: display server ready, starting the container")

        try {
            runner.stream(request(machine)).collect { send(it) }
        } finally {
            // The desktop is gone; the server has nothing left to draw.
            bridge.stop()
        }
    }

    /**
     * Installs whatever the display server needs and this machine lacks.
     *
     * Returns false when the install failed, having already said why: starting
     * the server anyway would only produce a black screen and a line of X
     * server output nobody can act on.
     */
    private suspend fun ProducerScope<String>.installMissingPrerequisites(
        rootfs: File,
        machine: Machine,
    ): Boolean {
        val missing = DisplayPrerequisites.missing(rootfs)
        if (missing.isEmpty()) return true

        for (name in missing) send("nawah: $name is missing — ${DisplayPrerequisites.reason(name)}")
        send("nawah: installing ${missing.joinToString(", ")}; this happens once")

        val status = runner.exec(
            request(machine).copy(
                command = listOf("/bin/sh", "-lc", DisplayPrerequisites.installCommand(missing)),
            ),
        ) { line -> trySend(line) }

        if (status != 0) {
            send("nawah: could not install ${missing.joinToString(", ")} (apt exited $status)")
            send("nawah: the desktop cannot start without it; check the network and try again")
            return false
        }
        val stillMissing = DisplayPrerequisites.missing(rootfs)
        if (stillMissing.isNotEmpty()) {
            send("nawah: ${stillMissing.joinToString(", ")} still missing after apt reported success")
            return false
        }
        send("nawah: display packages installed")
        return true
    }

    /** Stops the X server. The container is torn down by cancelling the flow. */
    fun stopDisplay() = bridge.stop()

    internal fun request(machine: Machine): ProotRequest {
        val env = buildMap {
            put("DISPLAY", ":0")
            // Not /tmp: it is 1777, and dbus refuses a world-writable runtime
            // directory outright. The session script creates this one 0700.
            put("XDG_RUNTIME_DIR", GuestScripts.RUNTIME_DIR)
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
        const val DISPLAY = ":0"
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
