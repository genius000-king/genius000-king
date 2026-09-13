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
    /** Full name, e.g. `"Debian 13"`. Used wherever a version stands alone. */
    val name: String,
    /**
     * Version label shown under its family, e.g. `"13"` or `"24.04 LTS"`.
     *
     * Separate from [name] because the picker is two levels now: the family
     * name is already on screen, and repeating "Ubuntu" inside every row of the
     * Ubuntu list is noise.
     */
    val version: String = name,
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
     * Archive components for the fallback `sources.list`.
     *
     * Debian and Ubuntu disagree on every one of these words, and hardcoding
     * Debian's set was the first place a second distribution would have broken:
     * `contrib non-free` does not exist on Ubuntu, and the arm64 packages are
     * not on `archive.ubuntu.com` at all.
     *
     * Only ever used when the image ships no usable sources of its own, which
     * in practice none of the catalog's images do — see
     * `ProotProvisioner.writeAptSources`.
     */
    val aptComponents: List<String> = listOf("main"),
    /** Long-term support release. Shown as a chip, and drives the default. */
    val lts: Boolean = false,
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
    val name: LocalizedText,
    /** APT package names, installed with `--no-install-recommends`. */
    val packages: List<String>,
    /** Command run inside the guest once X is up, e.g. `"startxfce4"`. */
    val startCommand: String,
    /** Extra installed bytes on top of the base rootfs. */
    val installedBytes: Long,
    /** See [DistroSpec.enabled]. */
    val enabled: Boolean = true,
)


/**
 * A distribution and every version of it the app can install.
 *
 * The picker used to be one flat list, and two distributions with three
 * releases each already made it a wall. Nobody scans twelve rows to find
 * "the normal one" — they look for a name they know, and only then care which
 * release. So the wizard asks those as two questions, and this is the first.
 *
 * Still data and nothing else: a third family is a new object in
 * `assets/catalog/distros.json`.
 */
@Serializable
data class DistroFamily(
    /** Stable identifier, e.g. `"debian"`. Never stored on a machine. */
    val id: String,
    /** Proper noun, the same in every language: `"Debian"`, `"Ubuntu"`. */
    val name: String,
    /** One line under the name, in the user's language. */
    val tagline: LocalizedText,
    /** Newest first. The picker highlights the first [DistroSpec.lts] entry. */
    val versions: List<DistroSpec>,
    /** See [DistroSpec.enabled]. */
    val enabled: Boolean = true,
) {
    /**
     * The version pre-selected when the family is opened.
     *
     * Newest LTS if there is one, newest otherwise. Never "whatever is first
     * in the file": the default a user accepts without reading is the one that
     * has to be right.
     */
    val default: DistroSpec?
        get() = versions.firstOrNull { it.enabled && it.lts }
            ?: versions.firstOrNull { it.enabled }
}
