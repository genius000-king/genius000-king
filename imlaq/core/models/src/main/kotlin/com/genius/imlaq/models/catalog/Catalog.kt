package com.genius.imlaq.models.catalog

import com.genius.imlaq.common.Bytes

/** One file of a model. A model over Hugging Face's 50 GB limit ships as several. */
data class CatalogFile(val name: String, val url: String, val bytes: Long)

/**
 * A model offered for one-tap download.
 *
 * [referenceTokensPerSecond] is MEASURED, not estimated: BigMoeOnEdge's benchmark on a 12 GB
 * phone with UFS 4 storage, default settings (its README and docs/benchmarks.md). It is what the
 * "fits your phone" judgment leans on until this phone has measured its own speed.
 */
data class CatalogEntry(
    val id: String,
    val name: String,
    /** Active vs total parameters, the one number that explains why it runs at all. */
    val activeParams: String,
    val files: List<CatalogFile>,
    val minRam: Bytes,
    val comfortableRam: Bytes,
    val referenceTokensPerSecond: Double,
) {
    val totalBytes: Long get() = files.sumOf { it.bytes }

    /** The file the engine opens (the first shard of a split model). */
    val entryFileName: String get() = files.first().name

    fun ownsFile(name: String) = files.any { it.name == name }
}

private const val HF = "https://huggingface.co"

/**
 * Short on purpose: the models the engine is measured on, smallest first. URLs and byte counts
 * come from BigMoeOnEdge's catalog (examples/android ModelCatalog.kt), which downloads them in CI.
 */
object Catalog {
    val entries: List<CatalogEntry> = listOf(
        CatalogEntry(
            id = "gemma4-26b",
            name = "Gemma 4 26B",
            activeParams = "4B نشطة من 26B",
            files = listOf(
                CatalogFile(
                    "google_gemma-4-26B-A4B-it-Q4_K_M.gguf",
                    "$HF/bartowski/google_gemma-4-26B-A4B-it-GGUF/resolve/main/google_gemma-4-26B-A4B-it-Q4_K_M.gguf?download=true",
                    17_035_038_112L,
                ),
            ),
            minRam = Bytes.gib(8),
            comfortableRam = Bytes.gib(12),
            referenceTokensPerSecond = 5.0,
        ),
        CatalogEntry(
            id = "qwen3-30b",
            name = "Qwen3 30B",
            activeParams = "3B نشطة من 30B",
            files = listOf(
                CatalogFile(
                    "Qwen3-30B-A3B-Q4_K_M.gguf",
                    "$HF/unsloth/Qwen3-30B-A3B-GGUF/resolve/main/Qwen3-30B-A3B-Q4_K_M.gguf?download=true",
                    18_556_686_912L,
                ),
            ),
            minRam = Bytes.gib(8),
            comfortableRam = Bytes.gib(12),
            referenceTokensPerSecond = 5.2,
        ),
        CatalogEntry(
            id = "qwen3.6-35b",
            name = "Qwen3.6 35B",
            activeParams = "3B نشطة من 35B",
            files = listOf(
                CatalogFile(
                    "Qwen_Qwen3.6-35B-A3B-Q4_K_M.gguf",
                    "$HF/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen_Qwen3.6-35B-A3B-Q4_K_M.gguf?download=true",
                    22_285_080_192L,
                ),
            ),
            minRam = Bytes.gib(8),
            comfortableRam = Bytes.gib(12),
            referenceTokensPerSecond = 5.8,
        ),
        CatalogEntry(
            id = "gpt-oss-120b",
            name = "gpt-oss 120B",
            activeParams = "5B نشطة من 117B",
            files = listOf(
                CatalogFile(
                    "gpt-oss-120b-Q4_K_M-00001-of-00002.gguf",
                    "$HF/unsloth/gpt-oss-120b-GGUF/resolve/main/Q4_K_M/gpt-oss-120b-Q4_K_M-00001-of-00002.gguf?download=true",
                    49_630_904_192L,
                ),
                CatalogFile(
                    "gpt-oss-120b-Q4_K_M-00002-of-00002.gguf",
                    "$HF/unsloth/gpt-oss-120b-GGUF/resolve/main/Q4_K_M/gpt-oss-120b-Q4_K_M-00002-of-00002.gguf?download=true",
                    13_137_819_360L,
                ),
            ),
            minRam = Bytes.gib(12),
            comfortableRam = Bytes.gib(16),
            // 1.3 with default settings; 2.2 is the tuned best case, not what a first run sees.
            referenceTokensPerSecond = 1.3,
        ),
        CatalogEntry(
            id = "deepseek-v4-flash",
            name = "DeepSeek V4 Flash",
            activeParams = "13B نشطة من 284B",
            files = listOf(
                CatalogFile(
                    "DeepSeek-V4-Flash-0731-UD-IQ2_M-00001-of-00003.gguf",
                    "$HF/unsloth/DeepSeek-V4-Flash-0731-GGUF/resolve/main/UD-IQ2_M/DeepSeek-V4-Flash-0731-UD-IQ2_M-00001-of-00003.gguf?download=true",
                    5_257_664L,
                ),
                CatalogFile(
                    "DeepSeek-V4-Flash-0731-UD-IQ2_M-00002-of-00003.gguf",
                    "$HF/unsloth/DeepSeek-V4-Flash-0731-GGUF/resolve/main/UD-IQ2_M/DeepSeek-V4-Flash-0731-UD-IQ2_M-00002-of-00003.gguf?download=true",
                    49_956_780_160L,
                ),
                CatalogFile(
                    "DeepSeek-V4-Flash-0731-UD-IQ2_M-00003-of-00003.gguf",
                    "$HF/unsloth/DeepSeek-V4-Flash-0731-GGUF/resolve/main/UD-IQ2_M/DeepSeek-V4-Flash-0731-UD-IQ2_M-00003-of-00003.gguf?download=true",
                    40_964_890_464L,
                ),
            ),
            minRam = Bytes.gib(12),
            comfortableRam = Bytes.gib(16),
            referenceTokensPerSecond = 0.94,
        ),
    )

    fun byId(id: String) = entries.firstOrNull { it.id == id }

    /** The catalog entry a file on disk belongs to, if any. */
    fun ownerOf(fileName: String) = entries.firstOrNull { it.ownsFile(fileName) }
}
