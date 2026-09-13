package io.nawah.linux.catalog

import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.DesktopWeight
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Reads the catalog the app actually ships, not a fixture.
 *
 * A JSON file in `assets/` has no compiler behind it: a renamed field or a
 * mistyped image reference is a crash on the wizard's first screen, and the
 * only thing standing between that and a release is this test.
 */
@RunWith(RobolectricTestRunner::class)
class CatalogTest {

    private val catalog = Catalog.load(ApplicationProvider.getApplicationContext())

    @Test
    fun `the shipped catalog parses`() {
        assertThat(catalog.families).isNotEmpty()
        assertThat(catalog.desktops).isNotEmpty()
    }

    @Test
    fun `both distributions are offered`() {
        assertThat(catalog.families.map { it.id }).containsExactly("debian", "ubuntu").inOrder()
    }

    @Test
    fun `every family has a default a first-time user can accept`() {
        for (family in catalog.families) {
            assertThat(family.default).isNotNull()
            assertThat(family.tagline.resolve("ar")).isNotEmpty()
            assertThat(family.tagline.resolve("en")).isNotEmpty()
            // A tagline that is the same in both languages means one is missing.
            assertThat(family.tagline.resolve("ar")).isNotEqualTo(family.tagline.resolve("en"))
        }
    }

    @Test
    fun `ubuntu points at the mirror that actually carries arm64`() {
        // archive.ubuntu.com has no arm64 packages at all. This is the entry
        // that would have failed on a device and nowhere else.
        val ubuntu = catalog.families.first { it.id == "ubuntu" }

        for (version in ubuntu.versions) {
            assertThat(version.aptMirror).contains("ports.ubuntu.com")
            assertThat(version.aptComponents).containsAtLeast("main", "universe")
        }
    }

    @Test
    fun `debian keeps debian's components`() {
        val debian = catalog.families.first { it.id == "debian" }

        for (version in debian.versions) {
            assertThat(version.aptMirror).contains("deb.debian.org")
            assertThat(version.aptComponents).contains("non-free-firmware")
        }
    }

    @Test
    fun `every release id is unique across families`() {
        // Machines record this id and nothing else; a collision would point two
        // different systems at one entry.
        val ids = catalog.distros.map { it.id }

        assertThat(ids).containsNoDuplicates()
    }

    @Test
    fun `every release names an image and a codename that agree`() {
        for (spec in catalog.distros) {
            assertThat(spec.image).endsWith(":${spec.codename}")
            assertThat(spec.downloadBytes).isGreaterThan(0L)
            assertThat(spec.installedBytes).isGreaterThan(spec.downloadBytes)
        }
    }

    @Test
    fun `the desktop with no start command is translated`() {
        val cli = catalog.desktops.first { it.id == "none" }

        assertThat(cli.startCommand).isEmpty()
        assertThat(cli.name.resolve("ar")).isNotEqualTo(cli.name.resolve("en"))
    }

    @Test
    fun `every desktop names a start command, except the one that has none`() {
        for (desktop in catalog.desktops) {
            if (desktop.id == "none") {
                assertThat(desktop.startCommand).isEmpty()
            } else {
                assertThat(desktop.startCommand).isNotEmpty()
                // Verified against Debian's own Contents index: each of these
                // is a real binary in the package set listed beside it.
                assertThat(desktop.packages).isNotEmpty()
            }
        }
    }

    @Test
    fun `the heavy desktops say so, because nothing else will tell the user`() {
        // Everything is drawn by llvmpipe on a phone CPU. GNOME and KDE will
        // install happily and then crawl, and finding that out after two
        // gigabytes is the worst possible moment.
        val heavy = catalog.desktops.filter { it.weight == DesktopWeight.HEAVY }.map { it.id }

        assertThat(heavy).containsExactly("kde", "gnome")
        for (desktop in catalog.desktops.filter { it.weight == DesktopWeight.HEAVY }) {
            assertThat(desktop.note).isNotNull()
            assertThat(desktop.note!!.resolve("ar")).isNotEqualTo(desktop.note!!.resolve("en"))
        }
    }

    @Test
    fun `the lightest desktops are actually the smallest`() {
        val byWeight = catalog.desktops.filter { it.installedBytes > 0 }.groupBy { it.weight }
        val light = byWeight[DesktopWeight.LIGHT].orEmpty().maxOf { it.installedBytes }
        val heavy = byWeight[DesktopWeight.HEAVY].orEmpty().minOf { it.installedBytes }

        assertThat(light).isLessThan(heavy)
    }

    @Test
    fun `every desktop id is unique`() {
        assertThat(catalog.desktops.map { it.id }).containsNoDuplicates()
    }

    @Test
    fun `no app installs a snap wrapper, which cannot run in a container`() {
        // The trap this exists for: on Ubuntu, `firefox` and `chromium-browser`
        // are transitional packages that pull a snap, and snaps do not run in a
        // proot container. Offering them there would install successfully and
        // produce a browser that cannot start.
        val snapTraps = setOf("firefox", "chromium-browser")
        val ubuntuPackages = catalog.apps.flatMap { it.packages["ubuntu"].orEmpty() }

        assertThat(ubuntuPackages).containsNoneIn(snapTraps)
        // And they are still offered where they are real debs.
        assertThat(catalog.apps.flatMap { it.packages["debian"].orEmpty() })
            .containsAtLeast("firefox-esr", "chromium")
    }

    @Test
    fun `every app offers at least one distribution, and none offers an empty list`() {
        for (app in catalog.apps) {
            assertThat(app.packages).isNotEmpty()
            for ((family, packages) in app.packages) {
                assertThat(packages).isNotEmpty()
                // A family nobody ships means an app that can never be chosen.
                assertThat(catalog.families.map { it.id }).contains(family)
            }
        }
    }

    @Test
    fun `an app with nothing for this distribution is not offered on it`() {
        val onUbuntu = catalog.appsFor("ubuntu-noble").map { it.id }
        val onDebian = catalog.appsFor("debian-trixie").map { it.id }

        assertThat(onDebian).containsAtLeast("firefox", "chromium", "falkon")
        assertThat(onUbuntu).contains("falkon")
        assertThat(onUbuntu).doesNotContain("firefox")
        assertThat(onUbuntu).doesNotContain("chromium")
    }

    @Test
    fun `every app is described in both languages`() {
        for (app in catalog.apps) {
            assertThat(app.description.resolve("ar")).isNotEmpty()
            assertThat(app.description.resolve("ar")).isNotEqualTo(app.description.resolve("en"))
            assertThat(app.installedBytes).isGreaterThan(0L)
        }
    }

    @Test
    fun `every app id is unique`() {
        assertThat(catalog.apps.map { it.id }).containsNoDuplicates()
    }

    @Test
    fun `a release can be found from the id a machine stores`() {
        assertThat(catalog.distro("ubuntu-noble")?.name).isEqualTo("Ubuntu 24.04 LTS")
        assertThat(catalog.familyOf("ubuntu-noble")?.name).isEqualTo("Ubuntu")
        assertThat(catalog.distro("does-not-exist")).isNull()
    }
}
