package com.genius.imlaq.models.hub

import com.genius.imlaq.models.download.DownloadSpec
import com.sun.net.httpserver.HttpServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress

/** The Hugging Face client against a local server replaying the real API's response shapes. */
class HuggingFaceTest {

    private lateinit var server: HttpServer
    private val base get() = "http://127.0.0.1:${server.address.port}"
    private val queries = mutableListOf<String>()

    // Shapes copied from huggingface.co/api responses (trimmed).
    private val searchJson = """
        [{"_id":"a","id":"unsloth/Qwen3-30B-A3B-GGUF","likes":1113,"downloads":6928970,"tags":["gguf"]},
         {"_id":"b","modelId":"bartowski/gemma-GGUF","likes":5,"downloads":100}]
    """
    private val treeJson = """
        [{"type":"directory","path":"BF16","size":0},
         {"type":"file","path":".gitattributes","size":3313},
         {"type":"file","path":"BF16/Qwen3-30B-A3B-BF16-00002-of-00002.gguf","size":134,"lfs":{"size":11401853280}},
         {"type":"file","path":"BF16/Qwen3-30B-A3B-BF16-00001-of-00002.gguf","size":134,"lfs":{"size":49693950144}},
         {"type":"file","path":"Qwen3-30B-A3B-Q4_K_M.gguf","size":134,"lfs":{"size":18556686912}},
         {"type":"file","path":"Qwen3-30B-A3B-Q2_K.gguf","size":134,"lfs":{"size":11258610432}},
         {"type":"file","path":"mmproj-F16.gguf","size":134,"lfs":{"size":900000000}},
         {"type":"file","path":"Q8/broken-00001-of-00003.gguf","size":134,"lfs":{"size":10}},
         {"type":"file","path":"README.md","size":4000}]
    """

    @Before
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/api/models") { ex ->
            queries += ex.requestURI.toString()
            val body = if (ex.requestURI.path.endsWith("/tree/main")) treeJson else searchJson
            val bytes = body.toByteArray()
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        server.createContext("/files/") { ex ->
            when (ex.requestURI.path) {
                "/files/model.gguf" -> {
                    ex.responseHeaders.add("Content-Range", "bytes 0-0/17035038112")
                    ex.sendResponseHeaders(206, 1)
                    ex.responseBody.use { it.write(0) }
                }
                "/files/download" -> {
                    ex.responseHeaders.add("Content-Disposition", "attachment; filename=\"My Model Q4.gguf\"")
                    ex.responseHeaders.add("Content-Range", "bytes 0-0/42")
                    ex.sendResponseHeaders(206, 1)
                    ex.responseBody.use { it.write(0) }
                }
                "/files/readme.txt" -> {
                    ex.responseHeaders.add("Content-Range", "bytes 0-0/10")
                    ex.sendResponseHeaders(206, 1)
                    ex.responseBody.use { it.write(0) }
                }
                else -> { ex.sendResponseHeaders(404, -1); ex.close() }
            }
        }
        server.start()
    }

    @After
    fun stop() = server.stop(0)

    @Test
    fun searchAsksForGgufReposByDownloads() {
        val repos = HuggingFace(base).search("qwen3 30b")
        assertEquals(listOf("unsloth/Qwen3-30B-A3B-GGUF", "bartowski/gemma-GGUF"), repos.map { it.id })
        assertEquals(6928970L, repos[0].downloads)
        val q = queries.single()
        assertTrue(q, q.contains("search=qwen3+30b") && q.contains("filter=gguf") && q.contains("sort=downloads"))
    }

    @Test
    fun filesGroupShardsSkipProjectorsAndIncompleteSets() {
        val files = HuggingFace(base).files("unsloth/Qwen3-30B-A3B-GGUF")
        assertEquals(listOf("Qwen3-30B-A3B-Q2_K", "Qwen3-30B-A3B-Q4_K_M", "Qwen3-30B-A3B-BF16"), files.map { it.label })

        val bf16 = files.last()
        assertEquals(listOf("Qwen3-30B-A3B-BF16-00001-of-00002.gguf", "Qwen3-30B-A3B-BF16-00002-of-00002.gguf"), bf16.files.map { it.name })
        assertEquals(49693950144L + 11401853280L, bf16.totalBytes)
        assertEquals("$base/unsloth/Qwen3-30B-A3B-GGUF/resolve/main/BF16/Qwen3-30B-A3B-BF16-00001-of-00002.gguf?download=true", bf16.files[0].source)
    }

    @Test
    fun aHubFileBecomesOneTransferWithAStableId() {
        val q4 = HuggingFace(base).files("unsloth/Qwen3-30B-A3B-GGUF").first { it.label.endsWith("Q4_K_M") }
        val spec = q4.toSpec()
        assertEquals("hf:unsloth/Qwen3-30B-A3B-GGUF:Qwen3-30B-A3B-Q4_K_M", spec.id)
        assertEquals(spec, DownloadSpec.decode(spec.encode()))
    }

    @Test
    fun aDirectLinkReportsItsNameAndSize() {
        val f = DirectLink.inspect("$base/files/model.gguf")
        assertEquals("model.gguf", f.name)
        assertEquals(17035038112L, f.bytes)
    }

    @Test
    fun theServersFileNameWinsOverTheUrl() {
        val f = DirectLink.inspect("$base/files/download")
        assertEquals("My Model Q4.gguf", f.name)
        assertEquals(42L, f.bytes)
    }

    @Test
    fun linksThatAreNotModelsAreRefusedWithAReason() {
        val notGguf = runCatching { DirectLink.inspect("$base/files/readme.txt") }.exceptionOrNull()
        assertTrue(notGguf is HubException)
        val missing = runCatching { DirectLink.inspect("$base/files/nope.gguf") }.exceptionOrNull()
        assertTrue(missing?.message.orEmpty(), missing is HubException && missing.message!!.contains("404"))
        val notAUrl = runCatching { DirectLink.inspect("ftp://x/y.gguf") }.exceptionOrNull()
        assertTrue(notAUrl is HubException)
    }

    @Test
    fun aHuggingFacePageLinkPointsAtTheFile() {
        assertEquals(
            "https://huggingface.co/u/r/resolve/main/m.gguf",
            DirectLink.normalise(" https://huggingface.co/u/r/blob/main/m.gguf "),
        )
    }
}
