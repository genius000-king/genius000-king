package com.genius.tvhub.engine.files.ops

import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.engine.files.guard.PathGuard
import java.io.File

/** Browse, copy, move, rename, delete — always through the [PathGuard]. Plain java.io: JVM-testable. */
class FileOps(private val guard: PathGuard) {

    fun list(dir: RemotePath): List<FileEntry> {
        val f = guard.resolve(dir)
        if (!f.isDirectory) throw RemoteException(ErrorCode.NOT_FOUND, "not a folder")
        val children = f.listFiles() ?: throw RemoteException(ErrorCode.DENIED, "Android does not allow reading this folder")
        return children
            .filter { !it.name.startsWith(".") }
            .map { FileEntry(dir.child(it.name), it.isDirectory, if (it.isFile) it.length() else 0, it.lastModified(), if (it.isFile) Mime.of(it.name) else null) }
            .sortedWith(compareBy<FileEntry> { !it.isDirectory }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.name })
    }

    fun mkdir(path: RemotePath) {
        guard.checkName(path.name)
        val f = guard.resolve(path)
        if (f.exists()) throw RemoteException(ErrorCode.INVALID, "already exists")
        if (!f.mkdirs()) throw RemoteException(ErrorCode.FAILED, "could not create folder")
    }

    fun rename(path: RemotePath, newName: String) {
        guard.checkName(newName)
        val src = guard.resolve(path)
        val dst = guard.resolve(path.parent()?.child(newName) ?: throw RemoteException(ErrorCode.INVALID, "cannot rename a root"))
        if (!src.exists()) throw RemoteException(ErrorCode.NOT_FOUND, "not found")
        if (dst.exists()) throw RemoteException(ErrorCode.INVALID, "a file with that name exists")
        if (!src.renameTo(dst)) throw RemoteException(ErrorCode.FAILED, "rename failed")
    }

    fun delete(paths: List<RemotePath>) = paths.forEach { p ->
        val f = guard.resolve(p)
        if (f == guard.root(p.root)) throw RemoteException(ErrorCode.INVALID, "cannot delete a root")
        if (f.exists() && !f.deleteRecursively()) throw RemoteException(ErrorCode.FAILED, "could not delete ${p.name}")
    }

    fun copy(sources: List<RemotePath>, destDir: RemotePath) = transfer(sources, destDir, move = false)

    fun move(sources: List<RemotePath>, destDir: RemotePath) = transfer(sources, destDir, move = true)

    private fun transfer(sources: List<RemotePath>, destDir: RemotePath, move: Boolean) {
        val dir = guard.resolve(destDir)
        if (!dir.isDirectory) throw RemoteException(ErrorCode.NOT_FOUND, "destination is not a folder")
        sources.forEach { p ->
            val src = guard.resolve(p)
            if (!src.exists()) throw RemoteException(ErrorCode.NOT_FOUND, "${p.name} not found")
            if (dir.path.startsWith(src.path + File.separator) || dir == src) throw RemoteException(ErrorCode.INVALID, "cannot put a folder inside itself")
            val target = uniqueTarget(dir, src.name)
            if (move && src.renameTo(target)) return@forEach
            if (!src.copyRecursively(target)) throw RemoteException(ErrorCode.FAILED, "copy failed")
            if (move) src.deleteRecursively()
        }
    }

    /** "a.mp4" → "a (2).mp4" when the name is taken. */
    private fun uniqueTarget(dir: File, name: String): File {
        var f = File(dir, name)
        var n = 2
        val base = name.substringBeforeLast('.', name)
        val ext = name.substringAfterLast('.', "").let { if (it.isEmpty() || it == name) "" else ".$it" }
        while (f.exists()) f = File(dir, "$base ($n)$ext").also { n++ }
        return f
    }
}

object Mime {
    private val map = mapOf(
        "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "png" to "image/png", "gif" to "image/gif", "webp" to "image/webp",
        "mp4" to "video/mp4", "mkv" to "video/x-matroska", "webm" to "video/webm", "avi" to "video/x-msvideo", "mov" to "video/quicktime",
        "mp3" to "audio/mpeg", "flac" to "audio/flac", "ogg" to "audio/ogg", "wav" to "audio/wav", "m4a" to "audio/mp4",
        "txt" to "text/plain", "md" to "text/markdown", "json" to "application/json", "js" to "text/javascript", "py" to "text/x-python",
        "html" to "text/html", "pdf" to "application/pdf", "zip" to "application/zip", "apk" to "application/vnd.android.package-archive",
    )
    fun of(name: String): String? = map[name.substringAfterLast('.', "").lowercase()]
}
