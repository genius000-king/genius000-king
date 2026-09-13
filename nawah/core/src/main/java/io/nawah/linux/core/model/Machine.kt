package io.nawah.linux.core.model

import kotlinx.serialization.Serializable

/**
 * How much of the device we let a machine use.
 *
 * Honest about what proot can do: there are no cgroups without root, so this
 * cannot cap RAM or CPU. What it *does* change is real — the package set, the
 * compositor, and the X display resolution — which is what actually moves the
 * resident set on a phone. Naming it a "profile" rather than a "memory limit"
 * is the whole point.
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
    /** PulseAudio sink on the Android side, reached over `tcp:127.0.0.1:4713`. */
    val audioOut: Boolean = true,
    /** Needs Android's `RECORD_AUDIO` runtime permission. */
    val microphone: Boolean = false,
    /** Binds `/storage/emulated/0` to `/sdcard` inside the guest. */
    val storage: Boolean = false,
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
    val displayWidth: Int,
    val displayHeight: Int,
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
