package io.nawah.linux.core.provision

import java.io.File

/**
 * The packages a machine must have before an X server can draw into it.
 *
 * Both entries here are fatal in the same invisible way: the X server prints
 * one line and exits, the desktop never appears, and the user is looking at a
 * black rectangle. Neither failure mentions a package.
 *
 * This is checked at **launch**, not only at install, for a plain reason: a
 * machine installed by an older build of the app does not have them, and the
 * answer to a missing 8 MB package cannot be "reinstall Debian".
 */
object DisplayPrerequisites {

    /**
     * A file that exists only once the package is installed *and configured*.
     *
     * Deliberately not the directory: `xfonts-base` unpacks its fonts and then
     * builds `fonts.dir` from a maintainer script. A rootfs where that script
     * did not run has the directory and no usable font, which is exactly the
     * state that produces `could not open default font`.
     */
    private data class Prerequisite(val packageName: String, val marker: String, val why: String)

    private val prerequisites = listOf(
        Prerequisite(
            packageName = "xkb-data",
            marker = "usr/share/X11/xkb/rules",
            why = "the X server refuses to start without a keyboard map",
        ),
        Prerequisite(
            packageName = "xfonts-base",
            marker = "usr/share/fonts/X11/misc/fonts.dir",
            why = "the X server aborts with \"could not open default font\"",
        ),
    )

    /** Packages missing from [rootfs], in install order. Empty is the normal case. */
    fun missing(rootfs: File): List<String> =
        prerequisites.filterNot { File(rootfs, it.marker).exists() }.map { it.packageName }

    /** Why each package is needed, for the session log. */
    fun reason(packageName: String): String =
        prerequisites.first { it.packageName == packageName }.why

    /**
     * The command that installs [packages] inside the guest.
     *
     * `apt-get update` is attempted only on failure: a machine that is merely
     * missing a package usually still has fresh lists, and re-downloading ten
     * megabytes of index on every launch is not acceptable on mobile data.
     */
    fun installCommand(packages: List<String>): String {
        val install = "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
            "--no-install-recommends ${packages.joinToString(" ")}"
        return "$install || { apt-get update && $install; }"
    }

    /** The X core font path, built from the directories that actually exist. */
    fun fontPath(rootfs: File): String? {
        val base = File(rootfs, "usr/share/fonts/X11")
        val dirs = FONT_DIRS.map { File(base, it) }.filter { File(it, "fonts.dir").isFile }
        return dirs.takeIf { it.isNotEmpty() }?.joinToString(",") { it.absolutePath }
    }

    /** Upstream's order, minus the ones Debian does not ship in every set. */
    private val FONT_DIRS = listOf("misc", "100dpi", "75dpi", "Type1", "TTF", "OTF")
}
