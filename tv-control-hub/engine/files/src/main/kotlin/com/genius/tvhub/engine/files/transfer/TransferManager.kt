package com.genius.tvhub.engine.files.transfer

import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.engine.files.guard.PathGuard
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Chunked uploads and downloads. Uploads land in "<name>.part" and are renamed on commit, so a
 * half-sent file never looks finished; chunks must arrive at the expected offset.
 */
class TransferManager(private val guard: PathGuard, private val now: () -> Long = System::currentTimeMillis) {
    private class Upload(val part: File, val target: File, val size: Long, var written: Long, var touched: Long)
    private class Download(val file: RandomAccessFile, val size: Long, var touched: Long)
    private val uploads = ConcurrentHashMap<String, Upload>()
    private val downloads = ConcurrentHashMap<String, Download>()

    fun beginUpload(path: RemotePath, size: Long, overwrite: Boolean): String {
        guard.checkName(path.name)
        val target = guard.resolve(path)
        if (target.exists() && !overwrite) throw RemoteException(ErrorCode.INVALID, "${path.name} already exists")
        val dir = target.parentFile ?: throw RemoteException(ErrorCode.INVALID, "no folder")
        if (!dir.isDirectory) throw RemoteException(ErrorCode.NOT_FOUND, "folder not found")
        if (dir.usableSpace in 0 until size) throw RemoteException(ErrorCode.FAILED, "not enough space on the TV")
        val part = File(dir, target.name + ".part").apply { delete(); createNewFile() }
        return id().also { uploads[it] = Upload(part, target, size, 0, now()) }
    }

    fun writeChunk(id: String, offset: Long, data: ByteArray) {
        val u = uploads[id] ?: throw RemoteException(ErrorCode.NOT_FOUND, "unknown upload")
        if (offset != u.written) throw RemoteException(ErrorCode.INVALID, "expected offset ${u.written}, got $offset")
        if (offset + data.size > u.size) throw RemoteException(ErrorCode.INVALID, "more data than declared")
        RandomAccessFile(u.part, "rw").use { it.seek(offset); it.write(data) }
        u.written += data.size
        u.touched = now()
    }

    fun commit(id: String) {
        val u = uploads.remove(id) ?: throw RemoteException(ErrorCode.NOT_FOUND, "unknown upload")
        if (u.written != u.size) { u.part.delete(); throw RemoteException(ErrorCode.INVALID, "upload incomplete: ${u.written}/${u.size}") }
        u.target.delete()
        if (!u.part.renameTo(u.target)) throw RemoteException(ErrorCode.FAILED, "could not finish the file")
    }

    fun beginDownload(path: RemotePath): Pair<String, Long> {
        val f = guard.resolve(path)
        if (!f.isFile) throw RemoteException(ErrorCode.NOT_FOUND, "not a file")
        val raf = RandomAccessFile(f, "r")
        return id().also { downloads[it] = Download(raf, raf.length(), now()) } to raf.length()
    }

    fun readChunk(id: String, offset: Long, maxBytes: Int): Pair<ByteArray, Boolean> {
        val d = downloads[id] ?: throw RemoteException(ErrorCode.NOT_FOUND, "unknown download")
        val n = minOf(maxBytes.coerceIn(1, MAX_CHUNK).toLong(), d.size - offset).toInt().coerceAtLeast(0)
        val buf = ByteArray(n)
        d.file.seek(offset); d.file.readFully(buf)
        d.touched = now()
        val eof = offset + n >= d.size
        if (eof) end(id)
        return buf to eof
    }

    fun end(id: String) {
        uploads.remove(id)?.part?.delete()
        downloads.remove(id)?.file?.close()
    }

    /** Drop transfers idle for [idleMillis] (a phone that walked away mid-upload). */
    fun sweep(idleMillis: Long = 120_000) {
        val cutoff = now() - idleMillis
        uploads.filterValues { it.touched < cutoff }.keys.forEach(::end)
        downloads.filterValues { it.touched < cutoff }.keys.forEach(::end)
    }

    private fun id() = UUID.randomUUID().toString()

    companion object { const val MAX_CHUNK = 256 * 1024 }
}
