package io.nawah.linux.core.provision

import io.nawah.linux.core.model.DistroSpec
import java.io.File

/**
 * What to do about a freshly unpacked rootfs's APT configuration.
 *
 * @param write content for `/etc/apt/sources.list`, or null to leave the image's
 *   own configuration untouched.
 * @param deleteLegacyList true when a `sources.list` sits alongside a deb822
 *   `.sources` file and duplicates it. Only ever true for a list *we* wrote.
 */
data class AptSourcesPlan(
    val write: String?,
    val deleteLegacyList: Boolean,
)

/**
 * Decides whether an image's APT sources need replacing.
 *
 * The version this replaced asked the wrong question. It looked for
 * `debian.sources`, and when it did not find one wrote a Debian `sources.list`:
 * `deb.debian.org`, `contrib non-free non-free-firmware`. Right for Debian and
 * ruinous for anything else — Ubuntu's arm64 packages are not on
 * `archive.ubuntu.com` at all (they are on `ports.ubuntu.com`), `contrib` and
 * `non-free` do not exist there, and 22.04 keeps its sources in the very
 * `sources.list` that would have been overwritten.
 *
 * So the question here is "does this image already have usable sources?",
 * never "which distribution is this?". Every image in the catalog does, which
 * makes [AptSourcesPlan.write] null in practice; the fallback exists for an
 * image that genuinely ships none, and is built from catalog fields rather than
 * from one distribution's vocabulary.
 */
object AptSources {

    private const val LIST = "etc/apt/sources.list"
    private const val DEB822_DIR = "etc/apt/sources.list.d"

    fun plan(rootfs: File, distro: DistroSpec): AptSourcesPlan {
        val deb822 = File(rootfs, DEB822_DIR)
            .listFiles { f -> f.isFile && f.name.endsWith(".sources") }
            .orEmpty()
        val list = File(rootfs, LIST)
        val listDeclaresSources = list.isFile && list.readText().declaresRepository()

        if (deb822.isNotEmpty()) {
            // The image's deb822 file is authoritative. A legacy list next to
            // it can only be one an older version of Nawah wrote, and leaving
            // it would duplicate every suite in `apt-get update`.
            return AptSourcesPlan(write = null, deleteLegacyList = listDeclaresSources)
        }
        if (listDeclaresSources) return AptSourcesPlan(write = null, deleteLegacyList = false)

        return AptSourcesPlan(write = fallbackList(distro), deleteLegacyList = false)
    }

    /** Suites and components from the catalog — never from a hardcoded distro. */
    internal fun fallbackList(distro: DistroSpec): String {
        val components = distro.aptComponents.joinToString(" ")
        return buildString {
            for (suite in listOf(distro.codename, "${distro.codename}-updates")) {
                appendLine("deb ${distro.aptMirror} $suite $components")
            }
        }
    }
}

/**
 * True when a `sources.list` actually declares a repository.
 *
 * Ubuntu 24.04 ships a `sources.list` holding four comment lines that say the
 * real sources moved to `ubuntu.sources`. "The file exists" would be wrong for
 * an image with no sources at all, and "the file is not empty" would be wrong
 * for that one.
 */
internal fun String.declaresRepository(): Boolean =
    lineSequence().any {
        val line = it.trimStart()
        line.startsWith("deb ") || line.startsWith("deb-src ")
    }
