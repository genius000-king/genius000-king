package com.genius.imlaq.engine.host.moe

import com.genius.imlaq.common.Bytes
import java.io.File

/** Where the dense (always-needed) weights live. See BigMoeOnEdge docs/android-memory.md. */
enum class DenseWeights(val flag: String) {
    /** Page cache; the kernel may drop them and re-read from flash. Best when the model fits. */
    MMAP("mmap"),

    /** Our own memory; under pressure they go to zram, not back to flash. The >RAM default. */
    ANON("anon"),

    /** dma-buf memory the kernel cannot reclaim at all. Android only. */
    PINNED("ahwb"),
}

sealed interface ExpertCache {
    /** The engine sizes the cache itself, always leaving [floor] of RAM free. */
    data class Auto(val floor: Bytes) : ExpertCache

    /** A budget the app decided (from the memory planner's grant). */
    data class Fixed(val size: Bytes) : ExpertCache
}

data class MoeLaunchConfig(
    val contextSize: Int = 4096,
    val threads: Int = 4,
    /** Stream experts from flash. False runs the model through plain mmap (dense models). */
    val streamExperts: Boolean = true,
    val cache: ExpertCache = ExpertCache.Auto(floor = Bytes.mib(1536)),
    val ioThreads: Int = 4,
    val denseWeights: DenseWeights = DenseWeights.ANON,
    /** Overlap flash reads with compute (needs the hook in BigMoeOnEdge's llama.cpp fork). */
    val overlap: Boolean = false,
)

object BmoeArgs {

    private const val SESSION_UBATCH = 512

    /**
     * The engine refuses a cache between 1 MiB and this unless forced: below it the LRU thrashes
     * (BigMoeOnEdge MoeStreamConfig::cache_min_mb).
     */
    val MIN_FIXED_CACHE: Bytes = Bytes.mib(1500)

    fun build(executable: File, model: File, cfg: MoeLaunchConfig): List<String> {
        val a = mutableListOf(
            executable.path,
            "-m", model.path,
            "-t", cfg.threads.toString(),
            "-c", cfg.contextSize.toString(),
            "--ubatch", minOf(SESSION_UBATCH, cfg.contextSize).toString(),
            // Renders the model's own chat template (the flag name is historical).
            "--chatml",
            "--session",
        )
        if (cfg.streamExperts) {
            a += "--moe-stream"
            when (val c = cfg.cache) {
                is ExpertCache.Auto -> a += listOf("--cache-mb", "auto", "--cache-floor-mb", c.floor.wholeMib.toString())
                is ExpertCache.Fixed -> {
                    a += listOf("--cache-mb", c.size.wholeMib.toString())
                    if (c.size > Bytes.ZERO && c.size < MIN_FIXED_CACHE) a += "--force-cache"
                }
            }
            a += listOf("--io-threads", cfg.ioThreads.toString())
            a += listOf("--dense-weights", cfg.denseWeights.flag)
            if (cfg.overlap) a += "--overlap"
        }
        return a
    }

    /**
     * Turns the memory planner's grant into an expert cache: what is left after the dense
     * weights, the KV cache and the runtime's own overhead.
     */
    fun cacheFromGrant(grant: Bytes, denseWeights: Bytes, kvCache: Bytes, overhead: Bytes = Bytes.mib(400)): ExpertCache.Fixed =
        ExpertCache.Fixed((grant - denseWeights - kvCache - overhead).coerceAtLeastZero())
}
