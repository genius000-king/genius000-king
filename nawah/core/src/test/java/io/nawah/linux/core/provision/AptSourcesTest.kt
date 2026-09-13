package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DistroSpec
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * The place a second distribution would have broken silently.
 *
 * Every rootfs below is what the real image actually ships — read out of the
 * published arm64 layers, not imagined. The four cases are genuinely different
 * and the old code got three of them wrong.
 */
class AptSourcesTest {

    @get:Rule val tmp = TemporaryFolder()

    private val debian = DistroSpec(
        id = "debian-trixie", name = "Debian 13", version = "13", codename = "trixie",
        image = "library/debian:trixie", downloadBytes = 1, installedBytes = 1,
        aptMirror = "http://deb.debian.org/debian",
        aptComponents = listOf("main", "contrib", "non-free", "non-free-firmware"),
    )

    private val ubuntu = DistroSpec(
        id = "ubuntu-noble", name = "Ubuntu 24.04 LTS", version = "24.04", codename = "noble",
        image = "library/ubuntu:noble", downloadBytes = 1, installedBytes = 1,
        aptMirror = "http://ports.ubuntu.com/ubuntu-ports",
        aptComponents = listOf("main", "universe", "restricted", "multiverse"),
    )

    private fun rootfs(): File = tmp.newFolder("rootfs-${System.nanoTime()}")

    private fun File.put(path: String, content: String) = apply {
        File(this, path).apply { parentFile?.mkdirs(); writeText(content) }
    }

    @Test
    fun `a debian image keeps its own deb822 sources`() {
        val root = rootfs().put(
            "etc/apt/sources.list.d/debian.sources",
            "Types: deb\nURIs: http://deb.debian.org/debian\nSuites: trixie\nComponents: main\n",
        )

        val plan = AptSources.plan(root, debian)

        assertThat(plan.write).isNull()
        assertThat(plan.deleteLegacyList).isFalse()
    }

    @Test
    fun `an ubuntu 24 image keeps ubuntu dot sources, not just debian dot sources`() {
        // The old code looked for the filename "debian.sources" specifically.
        // Ubuntu's is "ubuntu.sources", so the check missed it and the image's
        // working ports.ubuntu.com configuration was replaced by Debian's.
        val root = rootfs().put(
            "etc/apt/sources.list.d/ubuntu.sources",
            "Types: deb\nURIs: http://ports.ubuntu.com/ubuntu-ports/\n" +
                "Suites: noble noble-updates noble-backports\n" +
                "Components: main universe restricted multiverse\n",
        )

        val plan = AptSources.plan(root, ubuntu)

        assertThat(plan.write).isNull()
    }

    @Test
    fun `the comment-only sources list ubuntu 24 ships is not mistaken for sources`() {
        // Ubuntu 24.04 leaves a sources.list holding four comment lines that
        // say the real sources moved. It is neither missing nor usable.
        val root = rootfs()
            .put("etc/apt/sources.list.d/ubuntu.sources", "Types: deb\nURIs: http://ports.ubuntu.com/ubuntu-ports/\n")
            .put(
                "etc/apt/sources.list",
                "# Ubuntu sources have moved to the /etc/apt/sources.list.d/ubuntu.sources\n" +
                    "# file, which uses the deb822 format.\n",
            )

        val plan = AptSources.plan(root, ubuntu)

        assertThat(plan.write).isNull()
        // Nothing to delete: it declares no repository, so apt never reads it
        // twice, and removing a file the image shipped is not ours to do.
        assertThat(plan.deleteLegacyList).isFalse()
    }

    @Test
    fun `an ubuntu 22 image keeps its legacy sources list untouched`() {
        // 22.04 has no deb822 file at all. The old code would have overwritten
        // this with Debian's mirror, on an architecture that mirror does not
        // carry.
        val root = rootfs().put(
            "etc/apt/sources.list",
            "deb http://ports.ubuntu.com/ubuntu-ports/ jammy main restricted\n" +
                "deb http://ports.ubuntu.com/ubuntu-ports/ jammy universe\n",
        )

        val plan = AptSources.plan(root, ubuntu)

        assertThat(plan.write).isNull()
        assertThat(plan.deleteLegacyList).isFalse()
    }

    @Test
    fun `a legacy list we wrote beside a deb822 file is removed`() {
        // apt would otherwise fetch every target twice and warn about each.
        val root = rootfs()
            .put("etc/apt/sources.list.d/debian.sources", "Types: deb\nURIs: http://deb.debian.org/debian\n")
            .put("etc/apt/sources.list", "deb http://deb.debian.org/debian trixie main\n")

        assertThat(AptSources.plan(root, debian).deleteLegacyList).isTrue()
    }

    @Test
    fun `an image with no sources at all gets one built from the catalog`() {
        val plan = AptSources.plan(rootfs(), ubuntu)

        assertThat(plan.write).isNotNull()
        assertThat(plan.write!!).contains("http://ports.ubuntu.com/ubuntu-ports noble main universe restricted multiverse")
        assertThat(plan.write).contains("noble-updates")
        // The vocabulary of the distribution being installed, not of Debian.
        assertThat(plan.write).doesNotContain("non-free")
        assertThat(plan.write).doesNotContain("deb.debian.org")
    }

    @Test
    fun `the fallback for debian still carries debian's components`() {
        val written = AptSources.fallbackList(debian)

        assertThat(written).contains("deb.debian.org/debian trixie main contrib non-free non-free-firmware")
        assertThat(written).contains("trixie-updates")
    }

    @Test
    fun `a commented-out repository line does not count`() {
        assertThat("# deb http://example.invalid/ x main\n".declaresRepository()).isFalse()
        assertThat("deb http://example.invalid/ x main\n".declaresRepository()).isTrue()
        assertThat("  deb-src http://example.invalid/ x main\n".declaresRepository()).isTrue()
        assertThat("".declaresRepository()).isFalse()
    }
}
