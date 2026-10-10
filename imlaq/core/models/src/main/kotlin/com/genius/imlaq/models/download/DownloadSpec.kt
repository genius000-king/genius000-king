package com.genius.imlaq.models.download

import com.genius.imlaq.models.ModelType
import com.genius.imlaq.models.catalog.CatalogEntry
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * One file to fetch. [source] is an `https://` URL, or a `content://` URI for a file the user
 * picked on the phone — the same transfer machinery handles both.
 */
@Serializable
data class TransferFile(val name: String, val source: String, val bytes: Long)

/**
 * Everything one transfer needs, small enough to ride inside WorkManager's input data. A split
 * model is one spec with several files; the engine later opens the first.
 */
@Serializable
data class DownloadSpec(
    val id: String,
    val title: String,
    val files: List<TransferFile>,
    /** What the model does, known before the bytes arrive, so the list can say it while downloading. */
    val type: ModelType = ModelType.UNKNOWN,
) {
    val totalBytes: Long get() = files.sumOf { it.bytes }

    fun encode(): String = json.encodeToString(serializer(), this)

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun decode(text: String): DownloadSpec = json.decodeFromString(serializer(), text)

        fun of(entry: CatalogEntry) = DownloadSpec(
            id = "catalog:${entry.id}",
            title = entry.name,
            files = entry.files.map { TransferFile(it.name, it.url, it.bytes) },
            type = ModelType.TEXT,
        )
    }
}
