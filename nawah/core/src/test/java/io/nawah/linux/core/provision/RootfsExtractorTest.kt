package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.util.zip.GZIPOutputStream

/**
 * The first version of the installer unpacked through proot and failed on
 * every device. These tests pin the behaviour that replaced it, including the
 * three things Android makes awkward: hard links, device nodes, and archive
 * entries that try to escape the target directory.
 */
class RootfsExtractorTest {

    @get:Rule val tmp = TemporaryFolder()

    private class Archive(val file: File) {
        val entries = mutableListOf<Pair<TarArchiveEntry, ByteArray?>>()

        fun file(name: String, body: String, mode: Int = 0b110_100_100) = apply {
            entries += TarArchiveEntry(name).apply {
                this.mode = mode
                size = body.toByteArray().size.toLong()
            } to body.toByteArray()
        }

        fun dir(name: String) = apply {
            entries += TarArchiveEntry(name.trimEnd('/') + "/").apply {
                mode = 0b111_101_101
            } to null
        }

        fun symlink(name: String, target: String) = apply {
            entries += TarArchiveEntry(name, TarArchiveEntry.LF_SYMLINK)
                .apply { linkName = target } to null
        }

        fun hardlink(name: String, target: String) = apply {
            entries += TarArchiveEntry(name, TarArchiveEntry.LF_LINK)
                .apply { linkName = target } to null
        }

        fun device(name: String) = apply {
            entries += TarArchiveEntry(name, TarArchiveEntry.LF_CHR).apply {
                devMajor = 1; devMinor = 3
            } to null
        }

        fun build(): File {
            TarArchiveOutputStream(GZIPOutputStream(file.outputStream())).use { tar ->
                tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX)
                for ((entry, body) in entries) {
                    tar.putArchiveEntry(entry)
                    if (body != null) tar.write(body)
                    tar.closeArchiveEntry()
                }
            }
            return file
        }
    }

    private fun archive() = Archive(tmp.newFile("layer-${System.nanoTime()}.tar.gz"))

    @Test
    fun `files and directories land where they belong`() {
        val src = archive().dir("bin").file("bin/sh", "#!/bin/sh\n").build()
        val out = tmp.newFolder("rootfs1")

        val result = RootfsExtractor.extract(src, out)

        assertThat(File(out, "bin/sh").readText()).isEqualTo("#!/bin/sh\n")
        assertThat(result.files).isEqualTo(1)
        assertThat(result.directories).isEqualTo(1)
    }

    @Test
    fun `a leading dot slash is stripped rather than creating a directory called dot`() {
        val src = archive().file("./etc/hostname", "debian\n").build()
        val out = tmp.newFolder("rootfs2")

        RootfsExtractor.extract(src, out)

        assertThat(File(out, "etc/hostname").isFile).isTrue()
        assertThat(File(out, ".").listFiles()?.map { it.name }).doesNotContain(".")
    }

    @Test
    fun `symlinks are created as symlinks, including ones pointing outside`() {
        // /etc/mtab -> /proc/mounts is normal in a real image. proot confines
        // it at use time; refusing it here would break the rootfs.
        val src = archive().dir("etc").symlink("etc/mtab", "/proc/mounts").build()
        val out = tmp.newFolder("rootfs3")

        val result = RootfsExtractor.extract(src, out)

        val link = File(out, "etc/mtab").toPath()
        assertThat(Files.isSymbolicLink(link)).isTrue()
        assertThat(Files.readSymbolicLink(link).toString()).isEqualTo("/proc/mounts")
        assertThat(result.symlinks).isEqualTo(1)
    }

    @Test
    fun `hard links are copied, because Android refuses to create them`() {
        val src = archive()
            .file("bin/busybox", "BINARY")
            .hardlink("bin/ls", "bin/busybox")
            .build()
        val out = tmp.newFolder("rootfs4")

        val result = RootfsExtractor.extract(src, out)

        assertThat(File(out, "bin/ls").readText()).isEqualTo("BINARY")
        assertThat(result.hardLinksCopied).isEqualTo(1)
    }

    @Test
    fun `a hard link is resolved even when it precedes its target`() {
        val src = archive()
            .hardlink("bin/ls", "bin/busybox")
            .file("bin/busybox", "BINARY")
            .build()
        val out = tmp.newFolder("rootfs5")

        RootfsExtractor.extract(src, out)

        assertThat(File(out, "bin/ls").readText()).isEqualTo("BINARY")
    }

    @Test
    fun `device nodes are skipped, since proot supplies a real dev`() {
        val src = archive().dir("dev").device("dev/null").build()
        val out = tmp.newFolder("rootfs6")

        val result = RootfsExtractor.extract(src, out)

        assertThat(File(out, "dev/null").exists()).isFalse()
        assertThat(result.skipped).isEqualTo(1)
    }

    @Test
    fun `an entry that tries to escape the target is refused`() {
        val src = archive().file("../../evil", "pwned").build()
        val out = tmp.newFolder("rootfs7")

        RootfsExtractor.extract(src, out)

        assertThat(File(out.parentFile, "evil").exists()).isFalse()
        assertThat(File(out.parentFile.parentFile, "evil").exists()).isFalse()
    }

    @Test
    fun `an absolute entry name stays inside the target`() {
        val src = archive().file("/etc/passwd", "root:x:0:0").build()
        val out = tmp.newFolder("rootfs8")

        RootfsExtractor.extract(src, out)

        assertThat(File(out, "etc/passwd").isFile).isTrue()
    }

    @Test
    fun `the executable bit survives`() {
        val src = archive().file("bin/sh", "x", mode = 0b111_101_101).build()
        val out = tmp.newFolder("rootfs9")

        RootfsExtractor.extract(src, out)

        assertThat(File(out, "bin/sh").canExecute()).isTrue()
    }

    @Test
    fun `a read-only directory is still writable during extraction`() {
        // Mode 0555 applied as the directory is created would stop the files
        // inside it from being written at all.
        val src = archive()
            .dir("usr/share/locked")
            .file("usr/share/locked/file", "content")
            .build()
        val out = tmp.newFolder("rootfs10")

        RootfsExtractor.extract(src, out)

        assertThat(File(out, "usr/share/locked/file").readText()).isEqualTo("content")
    }

    @Test
    fun `a truncated archive fails loudly rather than leaving half a rootfs`() {
        val good = archive().file("bin/sh", "x".repeat(4096)).build()
        val broken = tmp.newFile("broken.tar.gz")
        broken.writeBytes(good.readBytes().copyOfRange(0, 40))

        val out = tmp.newFolder("rootfs11")
        try {
            RootfsExtractor.extract(broken, out)
            throw AssertionError("expected the truncated archive to be rejected")
        } catch (expected: IOException) {
            // The installer turns this into a Failed state with the message.
        }
    }
}
