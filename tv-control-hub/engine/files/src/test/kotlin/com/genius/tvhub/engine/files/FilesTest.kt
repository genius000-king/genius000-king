package com.genius.tvhub.engine.files

import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.engine.files.guard.PathGuard
import com.genius.tvhub.engine.files.ops.FileOps
import com.genius.tvhub.engine.files.transfer.TransferManager
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.nio.file.Files

class FilesTest {
    @get:Rule val tmp = TemporaryFolder()
    private val root by lazy { tmp.newFolder("root") }
    private val outside by lazy { tmp.newFolder("outside").also { File(it, "secret.txt").writeText("no") } }
    private val guard by lazy { PathGuard { mapOf("r" to root) } }
    private val ops by lazy { FileOps(guard) }

    private fun code(block: () -> Unit) = (runCatching(block).exceptionOrNull() as RemoteException).code

    @Test fun traversalIsRefused() {
        outside
        assertThat(code { guard.resolve(RemotePath("r", "../outside/secret.txt")) }).isEqualTo(ErrorCode.INVALID)
        assertThat(code { guard.resolve(RemotePath("r", "/etc/passwd")) }).isEqualTo(ErrorCode.INVALID)
        assertThat(code { guard.resolve(RemotePath("x", "a")) }).isEqualTo(ErrorCode.NOT_FOUND)
        assertThat(guard.resolve(RemotePath("r", "a/../b")).name).isEqualTo("b")
    }

    @Test fun symlinkOutOfRootIsRefused() {
        Files.createSymbolicLink(File(root, "link").toPath(), outside.toPath())
        assertThat(code { guard.resolve(RemotePath("r", "link/secret.txt")) }).isEqualTo(ErrorCode.INVALID)
    }

    @Test fun listSortsFoldersFirstAndHidesDotfiles() {
        File(root, "b.txt").writeText("x"); File(root, "A").mkdir(); File(root, ".hidden").writeText("")
        val names = ops.list(RemotePath("r")).map { it.name }
        assertThat(names).containsExactly("A", "b.txt").inOrder()
        assertThat(ops.list(RemotePath("r")).last().mime).isEqualTo("text/plain")
    }

    @Test fun mkdirRenameCopyMoveDelete() {
        ops.mkdir(RemotePath("r", "docs"))
        File(root, "a.txt").writeText("hello")
        ops.copy(listOf(RemotePath("r", "a.txt")), RemotePath("r", "docs"))
        ops.copy(listOf(RemotePath("r", "a.txt")), RemotePath("r", "docs"))
        assertThat(File(root, "docs").list()!!.sorted()).containsExactly("a (2).txt", "a.txt")
        ops.rename(RemotePath("r", "a.txt"), "b.txt")
        ops.move(listOf(RemotePath("r", "b.txt")), RemotePath("r", "docs"))
        assertThat(File(root, "b.txt").exists()).isFalse()
        assertThat(File(root, "docs/b.txt").readText()).isEqualTo("hello")
        ops.delete(listOf(RemotePath("r", "docs")))
        assertThat(File(root, "docs").exists()).isFalse()
    }

    @Test fun guardsAgainstSillyOperations() {
        File(root, "d").mkdir()
        assertThat(code { ops.rename(RemotePath("r", "d"), "../x") }).isEqualTo(ErrorCode.INVALID)
        assertThat(code { ops.move(listOf(RemotePath("r", "d")), RemotePath("r", "d")) }).isEqualTo(ErrorCode.INVALID)
        assertThat(code { ops.delete(listOf(RemotePath("r"))) }).isEqualTo(ErrorCode.INVALID)
    }

    @Test fun chunkedUploadAndDownload() {
        val t = TransferManager(guard)
        val data = ByteArray(600_000) { (it % 251).toByte() }
        val id = t.beginUpload(RemotePath("r", "big.bin"), data.size.toLong(), overwrite = false)
        var off = 0
        while (off < data.size) {
            val n = minOf(256 * 1024, data.size - off)
            t.writeChunk(id, off.toLong(), data.copyOfRange(off, off + n)); off += n
        }
        assertThat(File(root, "big.bin").exists()).isFalse() // still .part
        t.commit(id)
        assertThat(File(root, "big.bin").readBytes()).isEqualTo(data)

        val (dl, size) = t.beginDownload(RemotePath("r", "big.bin"))
        assertThat(size).isEqualTo(data.size.toLong())
        val out = java.io.ByteArrayOutputStream()
        var pos = 0L
        while (true) {
            val (chunk, eof) = t.readChunk(dl, pos, 256 * 1024)
            out.write(chunk); pos += chunk.size
            if (eof) break
        }
        assertThat(out.toByteArray()).isEqualTo(data)
    }

    @Test fun uploadRejectsGapsAndIncompleteCommits() {
        val t = TransferManager(guard)
        val id = t.beginUpload(RemotePath("r", "x.bin"), 10, false)
        assertThat(code { t.writeChunk(id, 5, ByteArray(2)) }).isEqualTo(ErrorCode.INVALID)
        t.writeChunk(id, 0, ByteArray(4))
        assertThat(code { t.commit(id) }).isEqualTo(ErrorCode.INVALID)
        assertThat(File(root, "x.bin.part").exists()).isFalse()
    }

    @Test fun idleTransfersAreSwept() {
        var now = 0L
        val t = TransferManager(guard) { now }
        val id = t.beginUpload(RemotePath("r", "y.bin"), 10, false)
        now = 200_000
        t.sweep()
        assertThat(code { t.writeChunk(id, 0, ByteArray(1)) }).isEqualTo(ErrorCode.NOT_FOUND)
    }
}
