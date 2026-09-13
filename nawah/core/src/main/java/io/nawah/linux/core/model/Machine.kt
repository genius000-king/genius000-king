package io.nawah.linux.core.model

import kotlinx.serialization.Serializable

/**
 * How much of the device we let a machine use.
 *
 * Honest about what proot can do: there are no cgroups without root, so this
 * cannot cap RAM or CPU.
 *
 * What it changes today is the compositor — [LIGHT] and [BALANCED] start the
 * desktop with compositing off, which is a real saving on a phone. It used to
 * claim it changed the package set too; it never did, and the claim is gone
 * rather than the code quietly gaining a branch to match it.
 */
enum class ResourceProfile { LIGHT, BALANCED, FULL }

/**
 * Per-machine Android-side permissions.
 *
 * Every flag here maps to a real bind or a real service on the Android side; a
 * toggle that changed nothing would be a lie told in a settings screen. That is
 * why there is no camera flag: `/dev/video*` is not reachable by an unprivileged
 * app, so it cannot be granted and is therefore not offered.
 */
@Serializable
data class MachinePermissions(
    /**
     * Sound out. PulseAudio runs *inside* the machine playing into a null sink,
     * whose monitor the app reads over loopback and feeds to an `AudioTrack`.
     */
    val audioOut: Boolean = true,
    /** Sound in, the same path backwards. Needs Android's `RECORD_AUDIO`. */
    val microphone: Boolean = false,
    /** Binds `/storage/emulated/0` to `/sdcard` inside the guest. */
    val storage: Boolean = false,
    /**
     * Inert, and kept only so machines written by older builds still load.
     *
     * It was a switch with nothing behind it. Cutting a container off the
     * network means a network namespace, a namespace means `unshare`, and that
     * means root — which is the one thing this app does not have. Nothing read
     * this field, and the UI no longer offers it.
     */
    @Deprecated("No effect; see the comment above.")
    val network: Boolean = true,
)

/**
 * An installed machine.
 *
 * Persisted as one small JSON document per machine. There is no database and no
 * code generation on purpose: the list is a handful of rows the user created by
 * hand, and a schema migration framework would cost more than it could ever
 * save at this size.
 */
@Serializable
data class Machine(
    /** UUID, and also the directory name under `<filesDir>/machines/`. */
    val id: String,
    /** User-chosen, shown on the home screen. Not an identifier. */
    val name: String,
    /** [DistroSpec.id] this machine was installed from. */
    val distroId: String,
    /** [DesktopSpec.id] installed into it. */
    val desktopId: String,
    val profile: ResourceProfile,
    val permissions: MachinePermissions,
    /**
     * Display size as a percentage of the phone's screen. 100 is native.
     *
     * Larger means a smaller X screen drawn at the same physical size: lighter
     * on the CPU and readable on a phone, with the aspect ratio still correct
     * and the screen still full.
     */
    val displayScalePercent: Int = 100,
    /**
     * Legacy, and inert.
     *
     * A pixel size was the wrong shape for this setting from the start. For
     * most of the app's life nothing read it; then it was wired to the X
     * server's `custom` mode and pinned the desktop to a 16:9 box on a
     * 19.5:9 phone — black bars on every side, and the result scaled up to the
     * panel, which is what "it went blurry" was. Kept only so machines written
     * by older builds still load.
     */
    val displayWidth: Int = 0,
    val displayHeight: Int = 0,
    val createdAtEpochMs: Long,
    val state: MachineState,
)

/**
 * Lifecycle of a machine on disk.
 *
 * [NEEDS_REPAIR] described a machine holding a guest-side X11 loader signed
 * with a key the current build no longer matches. That loader is gone — the X
 * server runs on the Android side now — so nothing sets this state any more.
 * It is kept only because it may be recorded in a machine installed by an older
 * build, and dropping the constant would fail to deserialise that machine's
 * metadata and hide it from the user's list.
 */
@Serializable
enum class MachineState { INSTALLING, READY, FAILED, NEEDS_REPAIR }
