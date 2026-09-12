package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.util.zip.GZIPInputStream

/**
 * Checks every package the installer asks for against a real Debian index.
 *
 * This exists because `xkeyboard-config` shipped in the base list and broke
 * every install with "E: Unable to locate package". It is the *source* package
 * name; the binary Debian publishes is `xkb-data`. Nothing in a unit test or a
 * compiler can tell those apart — only the archive can.
 *
 * Opt-in, because it needs the index. Point `NAWAH_TEST_PACKAGES` at a
 * decompressed or gzipped `Packages` file:
 *
 *   curl -s https://deb.debian.org/debian/dists/trixie/main/binary-arm64/Packages.gz \
 *     -o /tmp/Packages.gz
 *   NAWAH_TEST_PACKAGES=/tmp/Packages.gz ./gradlew :core:test
 */
class BasePackagesTest {

    private val index: File?
        get() = System.getenv("NAWAH_TEST_PACKAGES")?.let(::File)?.takeIf { it.isFile }

    private fun binaryPackageNames(file: File): Set<String> {
        val stream = if (file.name.endsWith(".gz")) {
            GZIPInputStream(file.inputStream())
        } else {
            file.inputStream()
        }
        return stream.bufferedReader().useLines { lines ->
            lines.filter { it.startsWith("Package: ") }
                .map { it.removePrefix("Package: ").trim() }
                .toSet()
        }
    }

    @Test
    fun `every base package is a real binary package`() {
        val file = index
        assumeTrue("set NAWAH_TEST_PACKAGES to run this", file != null)

        val available = binaryPackageNames(file!!)
        val missing = ProotProvisioner.BASE_PACKAGES.filterNot { it in available }

        assertThat(missing).isEmpty()
    }

    @Test
    fun `the base list has no source-only names`() {
        val file = index
        assumeTrue("set NAWAH_TEST_PACKAGES to run this", file != null)

        // The specific trap that caused the outage, kept as its own assertion
        // so the failure names itself.
        assertThat(ProotProvisioner.BASE_PACKAGES).doesNotContain("xkeyboard-config")
        assertThat(ProotProvisioner.BASE_PACKAGES).contains("xkb-data")
    }

    @Test
    fun `the base list has no duplicates and nothing blank`() {
        assertThat(ProotProvisioner.BASE_PACKAGES)
            .containsNoDuplicates()
        assertThat(ProotProvisioner.BASE_PACKAGES.filter { it.isBlank() }).isEmpty()
    }
}
