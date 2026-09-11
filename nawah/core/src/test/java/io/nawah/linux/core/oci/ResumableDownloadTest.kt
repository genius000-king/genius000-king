package io.nawah.linux.core.oci

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.toList
import okhttp3.HttpUrl.Companion.toHttpUrl
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/**
 * Cuts the connection halfway through a blob and checks the next attempt asks
 * the server to continue rather than starting the download again.
 *
 * This is the behaviour the user actually asked for after losing a 50 MB
 * download to a dropped connection, so it is worth testing against a socket
 * that really hangs up rather than a mock that pretends to.
 */
class ResumableDownloadTest {

    @get:Rule val tmp = TemporaryFolder()

    private lateinit var server: ServerSocket
    private val body = ByteArray(200_000) { (it % 251).toByte() }
    private val digest = "sha256:" + MessageDigest.getInstance("SHA-256")
        .digest(body).joinToString("") { "%02x".format(it) }

    /** Every Range the server was asked for, in order. */
    private val rangeRequests = mutableListOf<String>()
    private val connections = AtomicInteger()

    @After fun tearDown() { if (::server.isInitialized) server.close() }

    /**
     * @param cutAfter bytes to send on the first body response before hanging
     *   up, imitating a phone losing its connection mid-transfer.
     */
    private fun startServer(cutAfter: Int) {
        server = ServerSocket(0)
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = runCatching { server.accept() }.getOrNull() ?: return@thread
                thread(isDaemon = true) { runCatching { handle(socket, cutAfter) } }
            }
        }
    }

    private fun handle(socket: Socket, cutAfter: Int) = socket.use {
        val reader = socket.getInputStream().bufferedReader()
        val requestLine = reader.readLine() ?: return
        var range: String? = null
        while (true) {
            val line = reader.readLine() ?: break
            if (line.isEmpty()) break
            if (line.startsWith("Range:", true)) range = line.substringAfter(':').trim()
        }
        val out = socket.getOutputStream()

        when {
            requestLine.contains("/token") -> respondJson(out, """{"token":"t"}""")

            requestLine.contains("/blobs/") -> {
                val n = connections.incrementAndGet()
                val from = range?.removePrefix("bytes=")?.substringBefore('-')?.toIntOrNull() ?: 0
                range?.let { rangeRequests += it }
                val slice = body.copyOfRange(from, body.size)
                val status = if (from > 0) "206 Partial Content" else "200 OK"
                out.write(
                    ("HTTP/1.1 $status\r\n" +
                        "Content-Length: ${slice.size}\r\n" +
                        (if (from > 0) "Content-Range: bytes $from-${body.size - 1}/${body.size}\r\n" else "") +
                        "Connection: close\r\n\r\n").toByteArray(),
                )
                if (n == 1 && cutAfter in 1 until slice.size) {
                    // Send part of it, then hang up mid-stream.
                    out.write(slice, 0, cutAfter)
                    out.flush()
                    socket.close()
                } else {
                    out.write(slice)
                    out.flush()
                }
            }

            else -> out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".toByteArray())
        }
    }

    private fun respondJson(out: OutputStream, json: String) {
        out.write(
            ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n" +
                "Content-Length: ${json.toByteArray().size}\r\nConnection: close\r\n\r\n$json")
                .toByteArray(),
        )
        out.flush()
    }

    private fun client(): HttpOciClient {
        val base = "http://127.0.0.1:${server.localPort}/".toHttpUrl()
        return HttpOciClient(registryBaseUrl = base, authBaseUrl = base)
    }

    @Test
    fun `a connection cut halfway is resumed from where it stopped`() = runBlocking {
        startServer(cutAfter = 120_000)
        val target = tmp.newFile("layer.tar.gz").also { it.delete() }
        val layer = OciLayer(
            repository = "library/debian",
            digest = digest,
            sizeBytes = body.size.toLong(),
            mediaType = "application/vnd.oci.image.layer.v1.tar+gzip",
        )

        val events = client().pullLayer(layer, target).toList()

        assertThat(target.readBytes()).isEqualTo(body)
        assertThat(events.last()).isInstanceOf(PullEvent.Completed::class.java)
        // The second attempt asked for the remainder, not the whole blob again.
        assertThat(rangeRequests).isNotEmpty()
        assertThat(rangeRequests.first()).startsWith("bytes=120000-")
    }

    @Test
    fun `an uninterrupted download needs no range request`() = runBlocking {
        startServer(cutAfter = 0)
        val target = tmp.newFile("layer2.tar.gz").also { it.delete() }
        val layer = OciLayer(
            repository = "library/debian",
            digest = digest,
            sizeBytes = body.size.toLong(),
            mediaType = "application/vnd.oci.image.layer.v1.tar+gzip",
        )

        client().pullLayer(layer, target).toList()

        assertThat(target.readBytes()).isEqualTo(body)
        assertThat(rangeRequests).isEmpty()
    }

    @Test
    fun `the partial file is not left behind once the blob is complete`() = runBlocking {
        startServer(cutAfter = 90_000)
        val target = tmp.newFile("layer3.tar.gz").also { it.delete() }
        val layer = OciLayer(
            repository = "library/debian",
            digest = digest,
            sizeBytes = body.size.toLong(),
            mediaType = "application/vnd.oci.image.layer.v1.tar+gzip",
        )

        client().pullLayer(layer, target).toList()

        assertThat(java.io.File(target.path + ".part").exists()).isFalse()
    }
}
