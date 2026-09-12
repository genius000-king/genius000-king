package io.nawah.linux.core.provision

import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.model.ResourceProfile
import io.nawah.linux.core.store.MachineStore
import java.io.File
import java.io.InputStream

/**
 * Writes the app-owned files that live inside a machine's filesystem.
 *
 * These are **refreshed on every launch**, not written once at install time.
 * That distinction is the whole point of this class. When they were baked in
 * during installation, a one-character fix to the session script could only
 * reach an existing machine by reinstalling the entire distribution — twenty
 * minutes and a gigabyte to deliver a corrected line of shell. Users hit that
 * twice before it was fixed.
 *
 * Everything here is small, generated, and owned by the app rather than by the
 * distribution, so rewriting it costs milliseconds and is always safe.
 */
class GuestFileWriter(
    private val store: MachineStore,
    private val applicationId: String,
    /** Reads a file out of the app's assets; injected so this stays testable. */
    private val openAsset: (String) -> InputStream,
) {

    /**
     * Brings a machine's app-owned files up to date with this build.
     *
     * Safe to call on every start: it is idempotent, and the loader is only
     * rewritten when its bytes actually differ.
     */
    fun refresh(machine: Machine, desktop: DesktopSpec?) {
        val rootfs = store.rootfsDir(machine.id)
        writeLoader(rootfs)
        write(rootfs, GuestScripts.BRIDGE_PATH, GuestScripts.bridge(applicationId), executable = true)
        write(
            rootfs,
            GuestScripts.SESSION_PATH,
            GuestScripts.session(
                desktop = desktop ?: FALLBACK_DESKTOP,
                profile = machine.profile,
                audio = machine.permissions.audioOut,
            ),
            executable = true,
        )
    }

    /** Install-time entry point; identical work, named for where it is called. */
    fun install(machine: Machine, desktop: DesktopSpec?) = refresh(machine, desktop)

    private fun writeLoader(rootfs: File) {
        val target = File(rootfs, GuestScripts.LOADER_PATH.trimStart('/'))
        val fresh = openAsset(ASSET_LOADER).use { it.readBytes() }
        // Only rewrite when it differs: the loader is a megabyte, and a
        // launch should not pay for a copy that changes nothing.
        if (target.isFile && target.length() == fresh.size.toLong() &&
            target.readBytes().contentEquals(fresh)
        ) {
            return
        }
        target.parentFile?.mkdirs()
        target.writeBytes(fresh)
        target.setReadable(true, false)
    }

    private fun write(rootfs: File, guestPath: String, content: String, executable: Boolean) {
        val file = File(rootfs, guestPath.trimStart('/'))
        file.parentFile?.mkdirs()
        file.writeText(content)
        if (executable) file.setExecutable(true, false)
    }

    private companion object {
        const val ASSET_LOADER = "x11/loader.apk"

        /** A machine whose desktop id is no longer in the catalog still starts. */
        val FALLBACK_DESKTOP = DesktopSpec(
            id = "none",
            name = "Command line only",
            packages = emptyList(),
            startCommand = "",
            installedBytes = 0,
        )
    }
}
