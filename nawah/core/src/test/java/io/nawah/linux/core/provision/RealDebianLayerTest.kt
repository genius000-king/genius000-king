package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.nio.file.Files

/**
 * Runs the extractor against a real Debian layer rather than a synthetic one.
 *
 * Opt-in: set `NAWAH_TEST_LAYER` to a downloaded `library/debian` layer
 * tarball. Synthetic archives cannot reproduce what a real image contains —
 * PAX headers, device nodes under /dev, hundreds of symlinks, hard-linked
 * binaries — and the first version of the installer shipped precisely because
 * nothing exercised those.
 *
 *   TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io\
 *     &scope=repository:library/debian:pull" | jq -r .token)
 *   # resolve the arm64 manifest, then its single layer blob
 *   NAWAH_TEST_LAYER=/tmp/layer.tar.gz ./gradlew :core:test
 */
class RealDebianLayerTest {

    @get:Rule val tmp = TemporaryFolder()

    private val layer: File?
        get() = System.getenv("NAWAH_TEST_LAYER")?.let(::File)?.takeIf { it.isFile }

    @Test
    fun `a real debian layer unpacks into a usable rootfs`() {
        val archive = layer
        assumeTrue("set NAWAH_TEST_LAYER to run this", archive != null)

        val out = tmp.newFolder("rootfs")
        val result = RootfsExtractor.extract(archive!!, out)

        // The check the installer itself makes before going near apt.
        assertThat(File(out, "bin/sh").exists()).isTrue()

        assertThat(result.files).isGreaterThan(1_000)
        assertThat(result.symlinks).isGreaterThan(100)

        // Real images carry these, and each one broke an earlier version.
        assertThat(File(out, "usr/bin/dpkg").isFile).isTrue()
        assertThat(File(out, "etc/apt/sources.list.d").exists()).isTrue()
        assertThat(Files.isSymbolicLink(File(out, "bin").toPath()) ||
            File(out, "bin").isDirectory).isTrue()

        // No device node became a stray empty file.
        val devFiles = File(out, "dev").listFiles()?.filter { it.isFile }.orEmpty()
        assertThat(devFiles).isEmpty()

        // Nothing escaped.
        assertThat(File(out.parentFile, "etc").exists()).isFalse()
    }
}
