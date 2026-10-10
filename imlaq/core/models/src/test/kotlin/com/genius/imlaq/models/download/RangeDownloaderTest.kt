package com.genius.imlaq.models.download

import com.sun.net.httpserver.HttpServer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.net.InetSocketAddress
import kotlin.random.Random

/** Against a real HTTP server on localhost: full downloads, resumes, servers that ignore Range. */
class RangeDownloaderTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val body = Random(3).nextBytes(3 * 1024 * 1024 + 123)
    private lateinit var server: HttpServer
    private var honourRange = true
    private var cutAfter = -1 // close the connection after this many body bytes (once)
    private var status = 200
    private val rangeHeaders = mutableListOf<String?>()

    private val url get() = "http://127.0.0.1:${server.address.port}/model.gguf"

    @Before
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/model.gguf") { ex ->
            val range = ex.requestHeaders.getFirst("Range")
            rangeHeaders += range
            if (status != 200) {
                ex.sendResponseHeaders(status, -1); ex.close(); return@createContext
            }
            val from = if (honourRange && range != null) range.removePrefix("bytes=").removeSuffix("-").toInt() else 0
            val slice = body.copyOfRange(from, body.size)
            if (from > 0) ex.responseHeaders.add("Content-Range", "bytes $from-${body.size - 1}/${body.size}")
            ex.sendResponseHeaders(if (from > 0) 206 else 200, slice.size.toLong())
            ex.responseBody.use { out ->
                if (cutAfter in 0 until slice.size) {
                    out.write(slice, 0, cutAfter)
                    cutAfter = -1
                    out.flush()
                    ex.close() // drop the connection mid-body
                    return@createContext
                }
                out.write(slice)
            }
        }
        server.start()
    }

    @After
    fun stop() = server.stop(0)

    @Test
    fun downloadsTheWholeFileAndReportsProgress() {
        val part = tmp.newFile("m.part").apply { delete() }
        var last = 0L
        val size = RangeDownloader(bufferBytes = 64 * 1024).download(url, part, body.size.toLong(), onProgress = { d, _ -> last = d })
        assertEquals(body.size.toLong(), size)
        assertEquals(body.size.toLong(), last)
        assertArrayEquals(body, part.readBytes())
        assertEquals(listOf<String?>(null), rangeHeaders)
    }

    @Test
    fun aDroppedConnectionResumesWhereItStopped() {
        val part = tmp.newFile("m.part").apply { delete() }
        cutAfter = 1_000_000
        try {
            RangeDownloader(bufferBytes = 64 * 1024).download(url, part, body.size.toLong())
            fail("expected the cut to surface")
        } catch (e: DownloadException) {
            assertTrue(e.retryable)
        }
        val kept = part.length()
        assertTrue("kept $kept bytes", kept in 1..body.size.toLong() - 1)

        RangeDownloader(bufferBytes = 64 * 1024).download(url, part, body.size.toLong())
        assertEquals("bytes=$kept-", rangeHeaders.last())
        assertArrayEquals(body, part.readBytes())
    }

    @Test
    fun aServerThatIgnoresRangeRestartsCleanly() {
        val part = tmp.newFile("m.part")
        part.writeBytes(ByteArray(5000) { 9 }) // stale bytes that must not survive
        honourRange = false
        RangeDownloader().download(url, part, body.size.toLong())
        assertArrayEquals(body, part.readBytes())
    }

    @Test
    fun anAlreadyCompleteFileIsNotFetchedAgain() {
        val part = tmp.newFile("m.part")
        part.writeBytes(body)
        RangeDownloader().download(url, part, body.size.toLong())
        assertTrue(rangeHeaders.isEmpty())
    }

    @Test
    fun serverErrorsAreRetryableAndMissingFilesAreNot() {
        val part = tmp.newFile("m.part").apply { delete() }
        status = 503
        val busy = runCatching { RangeDownloader().download(url, part, body.size.toLong()) }.exceptionOrNull() as DownloadException
        assertTrue(busy.retryable)
        status = 404
        val missing = runCatching { RangeDownloader().download(url, part, body.size.toLong()) }.exceptionOrNull() as DownloadException
        assertFalse(missing.retryable)
    }

    @Test
    fun cancellingStopsBetweenBuffersAndKeepsWhatArrived() {
        val part = tmp.newFile("m.part").apply { delete() }
        var reads = 0
        val e = runCatching {
            RangeDownloader(bufferBytes = 64 * 1024).download(url, part, body.size.toLong(), isCancelled = { ++reads > 3 })
        }.exceptionOrNull() as DownloadException
        assertFalse(e.retryable)
        assertTrue(part.length() in 1 until body.size.toLong())
    }
}
