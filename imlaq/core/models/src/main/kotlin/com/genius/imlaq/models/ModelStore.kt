package com.genius.imlaq.models

import java.io.File

/**
 * One model on disk. A model over 50 GB ships as shards (`name-00001-of-00003.gguf`); the engine
 * opens the [entry] (first shard) and finds its siblings next to it.
 */
data class LocalModel(
    val entry: File,
    val shards: List<File>,
    val summary: ModelSummary?,
    val error: String?,
) {
    val displayName: String get() = summary?.name ?: entry.name.removeSuffix(".gguf")
    val complete: Boolean get() = error == null && summary != null
}

/**
 * The models directory. It must live on internal storage (Context.filesDir): the engine reads
 * experts with O_DIRECT, which the FUSE-backed shared storage (/sdcard) does not give at full
 * speed.
 */
class ModelStore(val root: File) {

    fun list(): List<LocalModel> {
        if (!root.isDirectory) return emptyList()
        val ggufs = root.walkTopDown().filter { it.isFile && it.name.endsWith(".gguf") }.toList()

        val singles = ggufs.filter { SHARD.matchEntire(it.name) == null }
        val sharded = ggufs.mapNotNull { f -> SHARD.matchEntire(f.name)?.let { m -> f to m } }
            .groupBy { (f, m) -> File(f.parentFile, m.groupValues[1]).path + "|" + m.groupValues[3] }

        val models = singles.map { open(it, listOf(it), expected = 1) } +
            sharded.values.map { group ->
                val files = group.sortedBy { (_, m) -> m.groupValues[2].toInt() }.map { it.first }
                val total = group.first().second.groupValues[3].toInt()
                open(files.first(), files, expected = total)
            }
        return models.sortedBy { it.displayName.lowercase() }
    }

    private fun open(entry: File, shards: List<File>, expected: Int): LocalModel {
        if (shards.size != expected) {
            return LocalModel(entry, shards, null, "missing shards: ${shards.size} of $expected")
        }
        return try {
            LocalModel(entry, shards, ModelSummary.from(shards.map(GgufReader::read)), null)
        } catch (e: Exception) {
            LocalModel(entry, shards, null, e.message ?: e.javaClass.simpleName)
        }
    }

    private companion object {
        val SHARD = Regex("""^(.*)-(\d{5})-of-(\d{5})\.gguf$""")
    }
}
