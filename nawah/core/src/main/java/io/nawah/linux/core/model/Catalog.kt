package io.nawah.linux.core.model

import kotlinx.serialization.Serializable

/**
 * A Linux distribution the app knows how to install.
 *
 * This is deliberately *data and nothing else*. The architectural promise of
 * Nawah is that adding Ubuntu or Arch after Debian is a new row in a JSON file
 * shipped in `assets/`, not a new code path. The moment a distro needs a
 * `when (id)` branch somewhere in the installer, that promise is broken — so
 * every knob a distro can turn lives here as a field.
 */
@Serializable
data class DistroSpec(
    /** Stable identifier, e.g. `"debian-trixie"`. Referenced by [Machine.distroId]. */
    val id: String,
    /** Human name shown in the wizard, e.g. `"Debian 13"`. */
    val name: String,
    /** Upstream codename, e.g. `"trixie"`. Used when templating `sources.list`. */
    val codename: String,
    /** OCI image reference pulled from the registry, e.g. `"library/debian:trixie"`. */
    val image: String,
    /** Compressed rootfs size in bytes, for the storage estimate shown to the user. */
    val downloadBytes: Long,
    /** Bytes the base rootfs occupies once extracted. */
    val installedBytes: Long,
    /** APT mirror templated into `sources.list`. */
    val aptMirror: String,
    /**
     * Off switch for a catalog entry we ship but are not ready to support.
     * Cheaper and more honest than deleting the row and losing its numbers.
     */
    val enabled: Boolean = true,
)

/**
 * A desktop environment.
 *
 * Same rule as [DistroSpec]: adding KDE or LXQt is a new entry here, nothing
 * more. [packages] feeds `apt-get install --no-install-recommends` verbatim and
 * [startCommand] is what the container's `startup.sh` execs once the X server is
 * listening, so a new desktop needs no installer change at all.
 */
@Serializable
data class DesktopSpec(
    /** Stable identifier, e.g. `"xfce4"`. Referenced by [Machine.desktopId]. */
    val id: String,
    /** Human name shown in the wizard, e.g. `"XFCE 4"`. */
    val name: String,
    /** APT package names, installed with `--no-install-recommends`. */
    val packages: List<String>,
    /** Command run inside the guest once X is up, e.g. `"startxfce4"`. */
    val startCommand: String,
    /** Extra installed bytes on top of the base rootfs. */
    val installedBytes: Long,
    /** See [DistroSpec.enabled]. */
    val enabled: Boolean = true,
)
