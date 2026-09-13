package io.nawah.linux.catalog

import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
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
    fun `a release can be found from the id a machine stores`() {
        assertThat(catalog.distro("ubuntu-noble")?.name).isEqualTo("Ubuntu 24.04 LTS")
        assertThat(catalog.familyOf("ubuntu-noble")?.name).isEqualTo("Ubuntu")
        assertThat(catalog.distro("does-not-exist")).isNull()
    }
}
