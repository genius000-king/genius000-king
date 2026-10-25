package com.genius.tvhub.engine.files.roots

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.storage.StorageManager
import com.genius.tvhub.core.model.FileRoot
import com.genius.tvhub.core.model.RootKind
import java.io.File

/**
 * The folders a phone may browse: this app's own storage always; the TV's shared storage and USB
 * drives when "All files access" is granted (one ADB command, see tools/tv-setup.sh).
 */
class RootsProvider(private val context: Context) {
    fun dirs(): Map<String, File> = buildMap {
        put(APP, context.getExternalFilesDir(null) ?: context.filesDir)
        if (sharedAllowed()) {
            put(SHARED, Environment.getExternalStorageDirectory())
            if (Build.VERSION.SDK_INT >= 30) {
                context.getSystemService(StorageManager::class.java).storageVolumes.filter { it.isRemovable }.forEach { v ->
                    v.directory?.let { put("usb:${v.uuid ?: it.name}", it) }
                }
            }
        }
    }

    fun roots(): List<FileRoot> = dirs().map { (id, dir) ->
        val stat = runCatching { StatFs(dir.path) }.getOrNull()
        val kind = when { id == APP -> RootKind.APP; id == SHARED -> RootKind.SHARED; else -> RootKind.REMOVABLE }
        FileRoot(id, labelFor(id, dir), kind, dir.canWrite(), stat?.totalBytes ?: 0, stat?.availableBytes ?: 0)
    }

    fun sharedAllowed() = if (Build.VERSION.SDK_INT >= 30) Environment.isExternalStorageManager() else true

    private fun labelFor(id: String, dir: File) = when (id) { APP -> "TV Hub"; SHARED -> "Storage"; else -> dir.name }

    companion object {
        const val APP = "app"
        const val SHARED = "shared"
    }
}
