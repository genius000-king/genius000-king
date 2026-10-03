package com.genius.saraat.engine

/**
 * Classic token bucket: tokens (bytes) refill continuously at [rate] and are spent when data
 * actually crosses the real network. The bucket is shared by every connection in one direction,
 * so the limit is a true device-wide cap rather than a per-connection one.
 *
 * [rate] may be changed from any thread; everything else is used by the engine thread only.
 */
internal class TokenBucket {
    /** Bytes per second. 0 (or less) means unlimited. */
    @Volatile
    var rate: Long = 0

    private var tokens = 0.0
    private var capacity = 0.0
    private var lastRate = -1L
    private var lastNanos = 0L

    /** Tokens currently available (Long.MAX_VALUE when unlimited). */
    fun available(now: Long): Long {
        val r = rate
        if (r <= 0) return Long.MAX_VALUE
        if (r != lastRate) {
            lastRate = r
            // ~100 ms of burst keeps traffic smooth yet precise; never less than a few packets.
            capacity = maxOf(r * BURST_SECONDS, MIN_BURST_BYTES.toDouble())
            tokens = if (lastNanos == 0L) capacity else minOf(tokens, capacity)
        }
        if (lastNanos == 0L) {
            lastNanos = now
            tokens = capacity
        }
        val dt = now - lastNanos
        lastNanos = now
        tokens = minOf(capacity, tokens + r * dt / 1e9)
        return tokens.toLong()
    }

    fun consume(bytes: Long) {
        if (rate > 0) tokens -= bytes
    }

    /** Nanoseconds until at least [bytes] tokens are available (0 if they already are). */
    fun nanosUntil(bytes: Long, now: Long): Long {
        val r = rate
        if (r <= 0) return 0
        val missing = bytes - available(now)
        return if (missing <= 0) 0 else (missing * 1e9 / r).toLong()
    }

    private companion object {
        const val BURST_SECONDS = 0.1
        const val MIN_BURST_BYTES = 8 * 1024
    }
}
