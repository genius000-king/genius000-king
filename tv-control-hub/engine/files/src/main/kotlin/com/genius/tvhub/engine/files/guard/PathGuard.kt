package com.genius.tvhub.engine.files.guard

import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import java.io.File

/**
 * The only way a phone's path becomes a real file. Every path is resolved inside a known root
 * and canonicalized; "..", absolute paths and symlinks pointing outside the root are refused.
 */
class PathGuard(private val roots: () -> Map<String, File>) {

    fun root(id: String): File = roots()[id]?.canonicalFile ?: throw RemoteException(ErrorCode.NOT_FOUND, "no root $id")

    fun resolve(path: RemotePath): File {
        val root = root(path.root)
        if (path.path.startsWith("/") || path.path.contains('\u0000')) throw invalid(path)
        val file = File(root, path.path).canonicalFile
        if (file != root && !file.path.startsWith(root.path + File.separator)) throw invalid(path)
        return file
    }

    /** The inverse: a real file back into the phone's coordinates. */
    fun relative(rootId: String, file: File): RemotePath {
        val root = root(rootId)
        val rel = file.canonicalFile.path.removePrefix(root.path).trimStart(File.separatorChar)
        return RemotePath(rootId, rel.replace(File.separatorChar, '/'))
    }

    /** A new name must be a name, not a path. */
    fun checkName(name: String) {
        if (name.isBlank() || name == "." || name == ".." || name.contains('/') || name.contains('\\') || name.contains('\u0000')) {
            throw RemoteException(ErrorCode.INVALID, "invalid name")
        }
    }

    private fun invalid(p: RemotePath) = RemoteException(ErrorCode.INVALID, "path escapes its root: ${p.path}")
}
