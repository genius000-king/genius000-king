package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

enum class RootKind { APP, SHARED, REMOVABLE }

@Serializable
data class FileRoot(val id: String, val label: String, val kind: RootKind, val writable: Boolean, val totalBytes: Long, val freeBytes: Long)

/** A path inside a root, always relative ("Movies/a.mp4"); the TV refuses anything escaping the root. */
@Serializable
data class RemotePath(val root: String, val path: String = "") {
    val name get() = path.substringAfterLast('/')
    fun child(name: String) = RemotePath(root, if (path.isEmpty()) name else "$path/$name")
    fun parent(): RemotePath? = if (path.isEmpty()) null else RemotePath(root, path.substringBeforeLast('/', ""))
}

@Serializable
data class FileEntry(val path: RemotePath, val isDirectory: Boolean, val size: Long, val modified: Long, val mime: String?) {
    val name get() = path.name
}
