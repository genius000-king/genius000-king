package com.genius.imlaq.models.hub

import com.genius.imlaq.models.download.DownloadSpec
import com.genius.imlaq.models.download.TransferFile
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.net.URLEncoder

/** A model repository on Hugging Face. */
data class HubRepo(val id: String, val downloads: Long, val likes: Long)

/**
 * One runnable model inside a repo: a single `.gguf`, or every shard of a split one.
 * [label] is the file name without the extension and the shard suffix (e.g. "Qwen3-30B-A3B-Q4_K_M").
 */
data class HubModelFile(val repo: String, val label: String, val files: List<TransferFile>) {
    val totalBytes: Long get() = files.sumOf { it.bytes }
    fun toSpec() = DownloadSpec(id = "hf:$repo:$label", title = label, files = files)
}

class HubException(message: String) : IOException(message)

/**
 * Hugging Face, the largest public home of open models: search, list a repo's GGUF files, and
 * the download URLs for them. Plain JVM so it is tested against a local server.
 */
class HuggingFace(private val base: String = "https://huggingface.co") {

    private val json = Json { ignoreUnknownKeys = true }

    /** GGUF repos matching [query], most downloaded first. */
    fun search(query: String, limit: Int = 30): List<HubRepo> {
        val q = URLEncoder.encode(query.trim(), "UTF-8")
        val arr = getJson("$base/api/models?search=$q&filter=gguf&sort=downloads&direction=-1&limit=$limit").jsonArray
        return arr.map { it.jsonObject }.mapNotNull { o ->
            val id = o.string("id") ?: o.string("modelId") ?: return@mapNotNull null
            HubRepo(id, o.long("downloads"), o.long("likes"))
        }
    }

    /**
     * Every GGUF model in [repo], smallest first. Split models are grouped; vision projectors
     * (mmproj) are left out because they do nothing on their own.
     */
    fun files(repo: String): List<HubModelFile> {
        val arr = getJson("$base/api/models/$repo/tree/main?recursive=true").jsonArray
        val ggufs = arr.map { it.jsonObject }
            .filter { it.string("type") == "file" }
            .mapNotNull { o ->
                val path = o.string("path") ?: return@mapNotNull null
                val size = (o["lfs"] as? JsonObject)?.long("size")?.takeIf { it > 0 } ?: o.long("size")
                path to size
            }
            .filter { (path, _) -> path.endsWith(".gguf", ignoreCase = true) && !path.substringAfterLast('/').contains("mmproj", ignoreCase = true) }

        return ggufs
            .groupBy { (path, _) -> groupKey(path) }
            .map { (key, group) ->
                val sorted = group.sortedBy { it.first }
                HubModelFile(
                    repo = repo,
                    label = key.substringAfterLast('/'),
                    files = sorted.map { (path, size) -> TransferFile(path.substringAfterLast('/'), resolveUrl(repo, path), size) },
                )
            }
            .filter { m -> SHARD.matchEntire(m.files.first().name)?.let { it.groupValues[3].toInt() == m.files.size } ?: true }
            .sortedBy { it.totalBytes }
    }

    fun resolveUrl(repo: String, path: String): String =
        "$base/$repo/resolve/main/${path.split('/').joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }}?download=true"

    private fun groupKey(path: String): String {
        val m = SHARD.matchEntire(path.substringAfterLast('/')) ?: return path.removeSuffix(".gguf")
        return path.substringBeforeLast('/', "").let { if (it.isEmpty()) "" else "$it/" } + m.groupValues[1]
    }

    private fun getJson(url: String) = try {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000; readTimeout = 30_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", USER_AGENT)
        }
        try {
            if (conn.responseCode != 200) throw HubException("Hugging Face ردّ بـ ${conn.responseCode}")
            json.parseToJsonElement(conn.inputStream.bufferedReader().readText())
        } finally {
            conn.disconnect()
        }
    } catch (e: HubException) {
        throw e
    } catch (e: Exception) {
        throw HubException("ما قدرت أوصل لـ Hugging Face")
    }

    private fun JsonObject.string(key: String) = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
    private fun JsonObject.long(key: String) = (this[key] as? JsonPrimitive)?.longOrNull ?: 0L

    companion object {
        const val USER_AGENT = "Imlaq/1 (Android)"
        private val SHARD = Regex("""^(.*)-(\d{5})-of-(\d{5})\.gguf$""")
    }
}

/**
 * A model from any site by a direct link: works out the file name and size before downloading,
 * so the space check and the progress bar have real numbers.
 */
object DirectLink {

    /** Hugging Face page links (".../blob/main/x.gguf") point at an HTML page; the file is at "resolve". */
    fun normalise(raw: String): String {
        val url = raw.trim()
        return if (url.contains("huggingface.co/") && url.contains("/blob/")) url.replaceFirst("/blob/", "/resolve/") else url
    }

    fun inspect(raw: String): TransferFile {
        val url = normalise(raw)
        if (!url.startsWith("https://") && !url.startsWith("http://")) throw HubException("الرابط لازم يبدأ بـ https://")
        val conn = try {
            (URL(url).openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = true
                connectTimeout = 15_000; readTimeout = 30_000
                setRequestProperty("Range", "bytes=0-0") // one byte: enough for the headers, works where HEAD does not
                setRequestProperty("User-Agent", HuggingFace.USER_AGENT)
            }
        } catch (e: Exception) {
            throw HubException("الرابط غير صالح")
        }
        try {
            val code = try { conn.responseCode } catch (e: IOException) { throw HubException("ما قدرت أوصل للرابط") }
            if (code !in listOf(200, 206)) throw HubException("الرابط ردّ بـ $code")
            val size = conn.getHeaderField("Content-Range")?.substringAfterLast('/')?.toLongOrNull()
                ?: conn.contentLengthLong.takeIf { code == 200 && it > 0 }
                ?: -1L
            val name = fileName(conn.getHeaderField("Content-Disposition"), conn.url.path.ifEmpty { URL(url).path })
            if (!name.endsWith(".gguf", ignoreCase = true)) throw HubException("الرابط لازم يكون لملف ‎.gguf")
            return TransferFile(name, url, size)
        } finally {
            conn.disconnect()
        }
    }

    internal fun fileName(disposition: String?, path: String): String {
        val fromHeader = disposition?.let {
            Regex("""filename\*=(?:UTF-8'')?([^;]+)""", RegexOption.IGNORE_CASE).find(it)?.groupValues?.get(1)
                ?: Regex("""filename="?([^";]+)"?""", RegexOption.IGNORE_CASE).find(it)?.groupValues?.get(1)
        }
        val raw = fromHeader ?: path.substringAfterLast('/')
        return URLDecoder.decode(raw.trim().trim('"'), "UTF-8").substringAfterLast('/')
    }
}
