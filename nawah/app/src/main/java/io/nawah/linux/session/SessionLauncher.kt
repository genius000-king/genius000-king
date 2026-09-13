package io.nawah.linux.session

import android.content.Context
import android.content.Intent
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.model.ResourceProfile
import io.nawah.linux.core.provision.GuestPrerequisites
import io.nawah.linux.core.provision.GuestFileWriter
import io.nawah.linux.core.provision.GuestScripts
import io.nawah.linux.usb.UsbDevices
import io.nawah.linux.usb.UsbSerialBridge
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
    private val display = LorieSettings(context)
    private var audio: AudioBridge? = null
    private var usb: UsbSerialBridge? = null

    /**
     * Brings the X display to the foreground. Safe to call when already open.
     *
     * [machine] is applied to the display's preferences first, because the X
     * activity reads its screen size when it creates its surface — after that
     * point a change costs a restart of the desktop.
     */
    fun openDisplay(machine: Machine? = null, keepScreenOn: Boolean = false) {
        machine?.let { display.applyScale(it.displayScalePercent) }
        display.applyKeepScreenOn(keepScreenOn)
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
        // Every stage is timed, and the times are in the log.
        //
        // "It takes a very long time to start" is not something to answer with
        // a guess -- three of this project's worst rounds were spent fixing the
        // wrong thing confidently. One launch of this build says exactly where
        // the seconds went.
        val clock = Stopwatch { line -> trySend(line) }

        // Rewritten every launch, never only at install time. A fix to the
        // session script must reach an existing machine through an app update,
        // not through reinstalling a gigabyte of Debian to deliver one line.
        guestFiles.refresh(machine, desktopFor(machine.desktopId))
        clock.mark("wrote the startup files")

        val rootfs = store.rootfsDir(machine.id)

        // A machine installed by an older build can be missing a package the
        // display server cannot start without. The answer to that is not
        // "reinstall Debian"; it is eight megabytes and one apt run, once.
        val wantsAudio = machine.permissions.audioOut || machine.permissions.microphone

        // The display's packages are fatal; the audio one is not, and treating
        // them alike was a bug: a machine with sound switched on and no
        // pulseaudio could not start a desktop at all, and retried an apt run
        // -- with an `apt-get update` fallback that fetches ten megabytes of
        // index -- on every single launch. Sound is worth less than a desktop.
        if (!installMissingPrerequisites(rootfs, machine, audio = false)) return@channelFlow
        if (wantsAudio) installMissingPrerequisites(rootfs, machine, audio = true)

        // The X server first, on this side of the container. Its output is
        // merged into the same log: when the desktop does not appear, the
        // reason is almost always in these lines.
        clock.mark("checked the system's packages")
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
        clock.mark("the display server is answering")
        send("nawah: display server ready, starting the container")

        // Started before the container, and patient: the guest's audio server
        // does not exist yet, so both pumps retry while it comes up. A failure
        // here is logged and nothing more -- a silent desktop beats no desktop.
        if (wantsAudio) {
            audio = AudioBridge(context) { line -> trySend(line) }.also {
                it.start(
                    speakerOut = machine.permissions.audioOut,
                    microphoneIn = machine.permissions.microphone,
                )
            }
        }

        // A USB serial adapter the user has already allowed becomes a real tty
        // inside the container. Attached before the container starts so the
        // bind exists from the first moment, and never fatal: a missing cable
        // must not cost a desktop.
        val serialPort = attachUsb()
        clock.mark("attached audio and USB")

        try {
            var first = true
            runner.stream(request(machine, serialPort)).collect {
                if (first) {
                    first = false
                    clock.mark("the container answered")
                }
                send(it)
            }
        } finally {
            // The desktop is gone; the server has nothing left to draw.
            bridge.stop()
            audio?.stop()
            audio = null
            usb?.close()
            usb = null
        }
    }

    /**
     * Opens a granted USB serial device, returning the tty to bind in.
     *
     * Android will not hand the container the device itself — the usbfs node is
     * unreadable to an app and the only way in is `UsbManager.openDevice`, so
     * the app holds it and bridges. Nothing is requested here: permission is
     * asked for in the UI, and a session starts with whatever was already
     * allowed.
     */
    private fun ProducerScope<String>.attachUsb(): String? {
        val devices = UsbDevices(context)
        val manager = devices.manager() ?: return null
        val driver = devices.firstGrantedDriver() ?: return null
        val bridge = UsbSerialBridge(manager) { line -> trySend(line) }
        val path = bridge.attach(driver)
        if (path == null) {
            bridge.close()
            return null
        }
        usb = bridge
        return path
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
        audio: Boolean,
    ): Boolean {
        val missing = GuestPrerequisites.missing(rootfs, audio)
        if (missing.isEmpty()) return true

        for (name in missing) send("nawah: $name is missing — ${GuestPrerequisites.reason(name)}")
        send("nawah: installing ${missing.joinToString(", ")}; this happens once")

        val status = runner.exec(
            request(machine).copy(
                command = listOf("/bin/sh", "-lc", GuestPrerequisites.installCommand(missing)),
            ),
        ) { line -> trySend(line) }

        if (status != 0) {
            send("nawah: could not install ${missing.joinToString(", ")} (apt exited $status)")
            send("nawah: the desktop cannot start without it; check the network and try again")
            return false
        }
        val stillMissing = GuestPrerequisites.missing(rootfs, audio)
        if (stillMissing.isNotEmpty()) {
            send("nawah: ${stillMissing.joinToString(", ")} still missing after apt reported success")
            return false
        }
        send("nawah: display packages installed")
        return true
    }

    /** Stops the X server and the audio pumps. */
    fun stopDisplay() {
        bridge.stop()
        audio?.stop()
        audio = null
    }

    internal fun request(machine: Machine, serialPty: String? = null): ProotRequest {
        val env = buildMap {
            put("DISPLAY", ":0")
            // Not /tmp: it is 1777, and dbus refuses a world-writable runtime
            // directory outright. The session script creates this one 0700.
            put("XDG_RUNTIME_DIR", GuestScripts.RUNTIME_DIR)
            put("XDG_SESSION_TYPE", "x11")
            // PULSE_SERVER is deliberately absent. It used to be set to
            // tcp:127.0.0.1:4713 with nothing listening there; the audio server
            // now runs inside the machine and its clients find it the ordinary
            // way, through XDG_RUNTIME_DIR.
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
            // The pty slave is a real device node in Android's /dev/pts, which
            // proot already binds -- so this is a rename, not a mount, and the
            // container sees an ordinary serial port.
            extraBinds = listOfNotNull(
                serialPty?.let { Bind(source = it, target = GuestScripts.USB_TTY) },
            ),
            env = env,
            command = listOf("/bin/sh", "-lc", SESSION_SCRIPT),
        )
    }

    private companion object {
        const val X11_ACTIVITY = "com.termux.x11.MainActivity"
        const val DISPLAY = ":0"
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
