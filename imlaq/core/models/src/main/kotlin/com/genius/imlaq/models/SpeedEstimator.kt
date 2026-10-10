package com.genius.imlaq.models

import com.genius.imlaq.common.Bytes

data class SpeedEstimate(
    /** What has to come off flash for every generated token. */
    val flashBytesPerToken: Bytes,
    val tokensPerSecond: Double,
    /** False when even the always-needed (dense) weights do not fit the RAM given. */
    val runnable: Boolean,
)

/**
 * The first-principles answer to "how fast will this be on my phone?", shown before a
 * multi-GB download:
 *
 *     seconds/token ≈ flash bytes per token / flash read speed
 *                   + active bytes per token / RAM bandwidth
 *
 * Assumptions, all pessimistic: routing is uniform (real routing is skewed, so the real cache hit
 * rate is higher); flash reads and compute do not overlap (the engine can overlap them). Treat the
 * result as a floor, then replace it with the measured figure after the first run.
 */
object SpeedEstimator {

    fun estimate(
        model: ModelSummary,
        ramForModel: Bytes,
        flashBytesPerSecond: Double,
        ramBytesPerSecond: Double,
    ): SpeedEstimate {
        require(flashBytesPerSecond > 0 && ramBytesPerSecond > 0)

        val flashPerToken: Bytes
        val runnable: Boolean
        if (model.kind == ModelKind.TEXT_MOE && model.expertCount > 0) {
            // Dense weights pinned in RAM; experts cached in what is left, streamed otherwise.
            runnable = model.denseBytes <= ramForModel
            val cache = (ramForModel - model.denseBytes).coerceAtLeastZero()
            val hitRate = if (model.expertBytes.value == 0L) 1.0
            else (cache.value.toDouble() / model.expertBytes.value).coerceIn(0.0, 1.0)
            val expertsPerToken = model.activeBytesPerToken - model.denseBytes
            flashPerToken = expertsPerToken * (1.0 - hitRate)
        } else {
            // Dense: a fixed resident part stays in RAM, the rest is read again every token.
            // (An LRU page cache would do worse: a cyclic scan larger than the cache evicts
            // exactly what is needed next. Pinning a fixed part is the optimum.)
            runnable = true
            flashPerToken = (model.totalBytes - ramForModel).coerceAtLeastZero()
        }

        val seconds = flashPerToken.value / flashBytesPerSecond +
            model.activeBytesPerToken.value / ramBytesPerSecond
        return SpeedEstimate(flashPerToken, if (seconds > 0) 1.0 / seconds else 0.0, runnable)
    }
}
