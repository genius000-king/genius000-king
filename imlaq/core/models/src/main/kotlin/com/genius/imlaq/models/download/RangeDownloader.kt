package com.genius.imlaq.models.download

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL

class DownloadException(message: String, val retryable: Boolean) : IOException(message)

/**
 * Streams one URL into a `.part` file, resuming from whatever the file already holds with an
 * HTTP `Range` request. A multi-GB transfer that drops at 80% continues from 80%.
 *
 * Plain JVM (no Android) so it is tested against a real local HTTP server.
 */
class RangeDownloader(
    private val connectTimeoutMs: Int = 20_000,
    private val readTimeoutMs: Int = 60_000,
    private val bufferBytes: Int = 1 shl 20,
) {

    /**
     * Downloads into [part] until it holds [expectedBytes] (or the server's length when that is
     * unknown). [onProgress] gets (bytes in the file, total). [isCancelled] is polled between
     * buffers. Returns the final size.
     */
    fun download(
        url: String,
        part: File,
        expectedBytes: Long,
        onProgress: (Long, Long) -> Unit = { _, _ -> },
        isCancelled: () -> Boolean = { false },
    ): Long {
        val have = if (part.isFile) part.length() else 0L
        if (expectedBytes > 0 && have == expectedBytes) return have
        if (expectedBytes > 0 && have > expectedBytes) part.delete()

        val from = if (part.isFile) part.length() else 0L
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "Imlaq/1 (Android)")
            if (from > 0) setRequestProperty("Range", "bytes=$from-")
        }
        try {
            val code = conn.responseCode
            val resuming = when (code) {
                HttpURLConnection.HTTP_PARTIAL -> true
                HttpURLConnection.HTTP_OK -> false // server ignored Range: start over
                416 -> return if (expectedBytes > 0 && from == expectedBytes) from else {
                    part.delete()
                    throw DownloadException("server refused the resume range", retryable = true)
                }
                in 500..599, 408, 429 -> throw DownloadException("server busy ($code)", retryable = true)
                else -> throw DownloadException("download failed (HTTP $code)", retryable = false)
            }
            val start = if (resuming) from else 0L
            val length = conn.contentLengthLong
            val total = when {
                expectedBytes > 0 -> expectedBytes
                length > 0 -> start + length
                else -> -1L
            }

            RandomAccessFile(part, "rw").use { out ->
                out.setLength(start)
                out.seek(start)
                var done = start
                val buf = ByteArray(bufferBytes)
                conn.inputStream.use { inp ->
                    var lastReport = 0L
                    while (true) {
                        if (isCancelled()) throw DownloadException("cancelled", retryable = false)
                        val n = inp.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        if (done - lastReport >= 8L * bufferBytes) {
                            onProgress(done, total)
                            lastReport = done
                        }
                    }
                }
                onProgress(done, total)
                if (total > 0 && done != total) {
                    throw DownloadException("connection closed at ${done shr 20} MiB of ${total shr 20}", retryable = true)
                }
                return done
            }
        } catch (e: DownloadException) {
            throw e
        } catch (e: IOException) {
            throw DownloadException(e.message ?: "network error", retryable = true)
        } finally {
            conn.disconnect()
        }
    }
}
