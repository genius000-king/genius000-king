package io.nawah.linux.core.provision

import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.util.zip.GZIPInputStream

/**
 * Unpacks a container image layer into a rootfs directory.
 *
 * This runs on the Android side, not inside proot. The first version shelled
 * out to busybox through proot and failed on every device: proot resolves the
 * command it is given *inside the guest*, so a host path like
 * `/data/app/.../libbusybox.so` is looked up in an empty rootfs and reported
 * missing. Doing the work here removes that class of failure entirely, and
 * makes the whole thing testable on a JVM.
 *
 * Three things a naive extractor gets wrong on Android:
 *
 *  - **Hard links.** Android's filesystem refuses them, and a Debian layer has
 *    plenty. Each one is copied instead. It costs a few megabytes and it works.
 *  - **Device nodes and FIFOs.** An app cannot create them at all, and it does
 *    not need to: proot binds a real `/dev` over whatever is there.
 *  - **Path traversal.** Archive entry names are untrusted input. An entry
 *    named `../../etc/passwd` must not escape the rootfs, and a symlink is
 *    never followed while writing.
 */
object RootfsExtractor {

    /** Reports bytes of the compressed stream consumed so far. */
    fun interface Progress {
        fun onProgress(readBytes: Long, totalBytes: Long)
    }

    data class Result(
        val files: Int,
        val directories: Int,
        val symlinks: Int,
        val hardLinksCopied: Int,
        val skipped: Int,
    )

    /**
     * @throws IOException if the archive is malformed, escapes [target], or the
     *   filesystem refuses a write. Never partially succeeds silently.
     */
    fun extract(archive: File, target: File, progress: Progress? = null): Result {
        require(target.isDirectory || target.mkdirs()) { "cannot create $target" }
        val root = target.canonicalFile
        val total = archive.length()

        var files = 0
        var dirs = 0
        var links = 0
        var copied = 0
        var skipped = 0
        // Hard links can point at an entry that has not been written yet, so
        // they are resolved after the pass rather than during it.
        val pendingHardLinks = mutableListOf<Pair<File, String>>()
        val deferredModes = mutableListOf<Pair<File, Int>>()

        CountingInputStream(archive.inputStream().buffered()) { read ->
            progress?.onProgress(read, total)
        }.use { counting ->
            TarArchiveInputStream(GZIPInputStream(counting, 64 * 1024)).use { tar ->
                while (true) {
                    val entry = tar.nextEntry ?: break
                    // PAX metadata entries describe the next entry; they are
                    // not content and must never be written out.
                    if (entry.isPaxHeader || entry.isGlobalPaxHeader) continue
                    val out = resolve(root, entry.name) ?: continue

                    when {
                        // Checked before isFile(): commons-compress reports a
                        // character device as a file, so leaving this last
                        // writes /dev/null out as an empty regular file.
                        entry.isCharacterDevice || entry.isBlockDevice ||
                            entry.isFIFO -> skipped++

                        entry.isDirectory -> {
                            out.mkdirs(); dirs++
                            deferredModes += out to entry.mode
                        }

                        entry.isSymbolicLink -> {
                            out.parentFile?.mkdirs()
                            deleteIfPresent(out)
                            // The target is not resolved or validated here: a
                            // symlink pointing outside the rootfs is normal
                            // (/etc/mtab -> /proc/mounts) and proot confines it
                            // at use time, which is the only place it can be
                            // judged correctly.
                            Files.createSymbolicLink(out.toPath(), File(entry.linkName).toPath())
                            links++
                        }

                        entry.isLink -> pendingHardLinks += out to entry.linkName

                        entry.isFile -> {
                            out.parentFile?.mkdirs()
                            deleteIfPresent(out)
                            out.outputStream().buffered().use { tar.copyTo(it) }
                            files++
                            deferredModes += out to entry.mode
                        }

                        else -> skipped++
                    }
                }
            }
        }

        for ((link, targetName) in pendingHardLinks) {
            val source = resolve(root, targetName)
            if (source == null || !source.isFile) { skipped++; continue }
            link.parentFile?.mkdirs()
            deleteIfPresent(link)
            source.copyTo(link, overwrite = true)
            link.setExecutable(source.canExecute(), false)
            copied++
        }

        // Applied last: writing into a directory needs the write bit, which a
        // mode of 0555 would have taken away mid-extraction.
        for ((file, mode) in deferredModes) applyMode(file, mode)

        return Result(files, dirs, links, copied, skipped)
    }

    /** Null when the entry would land outside [root], or names nothing. */
    private fun resolve(root: File, name: String): File? {
        val clean = name.trim().removePrefix("./")
        if (clean.isEmpty() || clean == "." || clean == "/") return null
        val candidate = File(root, clean)
        val path = candidate.path
        val rootPath = root.path
        if (path != rootPath && !path.startsWith(rootPath + File.separator)) return null
        // Reject traversal before any filesystem call: `..` inside the name is
        // the only way an entry reaches outside, and normalising first means
        // we never touch the escaping path at all.
        if (clean.split('/').any { it == ".." }) return null
        return candidate
    }

    private fun deleteIfPresent(file: File) {
        if (file.exists() || Files.isSymbolicLink(file.toPath())) {
            if (file.isDirectory && !Files.isSymbolicLink(file.toPath())) file.deleteRecursively()
            else file.delete()
        }
    }

    private fun applyMode(file: File, mode: Int) {
        if (mode == 0) return
        file.setReadable(mode and 0b100_000_000 != 0, false)
        file.setWritable(mode and 0b010_000_000 != 0, true)
        file.setExecutable(mode and 0b001_000_000 != 0, false)
    }
}

/** Counts bytes as they are read, so progress reflects the compressed stream. */
private class CountingInputStream(
    private val delegate: java.io.InputStream,
    private val onRead: (Long) -> Unit,
) : java.io.InputStream() {
    private var count = 0L
    private var lastReported = 0L

    override fun read(): Int = delegate.read().also { if (it >= 0) advance(1) }

    override fun read(b: ByteArray, off: Int, len: Int): Int =
        delegate.read(b, off, len).also { if (it > 0) advance(it.toLong()) }

    private fun advance(n: Long) {
        count += n
        // Reporting every buffer would flood the UI; a megabyte is enough to
        // keep a progress bar honest.
        if (count - lastReported >= 1L shl 20) {
            lastReported = count
            onRead(count)
        }
    }

    override fun close() = delegate.close()
}
