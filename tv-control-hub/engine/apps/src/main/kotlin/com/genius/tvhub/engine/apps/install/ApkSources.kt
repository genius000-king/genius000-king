package com.genius.tvhub.engine.apps.install

import android.content.Context
import android.os.Environment
import android.os.storage.StorageManager
import android.os.Build
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** An APK file found on the TV (Downloads, a USB stick). */
data class LocalApk(val file: File, val sizeBytes: Long)

/** Finds APK files where people put them: Downloads and removable drives. Needs all-files access. */
class LocalApkScanner(private val context: Context) {
    fun scan(maxDepth: Int = 3): List<LocalApk> {
        val roots = buildList {
            add(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS))
            if (Build.VERSION.SDK_INT >= 30) {
                context.getSystemService(StorageManager::class.java).storageVolumes.filter { it.isRemovable }.mapNotNullTo(this) { it.directory }
            }
        }
        return roots.flatMap { walk(it, maxDepth) }.distinctBy { it.file.absolutePath }.sortedByDescending { it.file.lastModified() }
    }

    private fun walk(dir: File, depth: Int): List<LocalApk> {
        if (depth < 0 || !dir.canRead()) return emptyList()
        return (dir.listFiles() ?: emptyArray()).flatMap { f ->
            when {
                f.isDirectory && !f.name.startsWith(".") -> walk(f, depth - 1)
                f.isFile && f.name.endsWith(".apk", ignoreCase = true) -> listOf(LocalApk(f, f.length()))
                else -> emptyList()
            }
        }
    }
}

/** Downloads an APK from a link into the app cache, reporting progress (0..1, or -1 when unknown). */
class ApkDownloader(private val context: Context) {
    fun download(url: String, onProgress: (Float) -> Unit): File {
        require(url.startsWith("https://") || url.startsWith("http://")) { "not a web link" }
        val target = File(context.cacheDir, "download-${System.currentTimeMillis()}.apk")
        var connection = URL(url).openConnection() as HttpURLConnection
        var redirects = 0
        while (connection.responseCode in 300..399 && redirects++ < 5) {
            val next = connection.getHeaderField("Location") ?: break
            connection.disconnect()
            connection = URL(URL(url), next).openConnection() as HttpURLConnection
        }
        check(connection.responseCode == 200) { "server answered ${connection.responseCode}" }
        val total = connection.contentLengthLong
        connection.inputStream.use { input ->
            target.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                var done = 0L
                while (true) {
                    val n = input.read(buf); if (n < 0) break
                    out.write(buf, 0, n); done += n
                    onProgress(if (total > 0) done.toFloat() / total else -1f)
                }
            }
        }
        return target
    }
}
