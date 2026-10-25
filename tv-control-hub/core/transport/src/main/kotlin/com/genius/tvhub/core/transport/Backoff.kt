package com.genius.tvhub.core.transport

import kotlin.random.Random

/**
 * Reconnect delays: quick first retries (Wi-Fi blips are short), then exponential up to [maxMillis],
 * with ±20% jitter so two phones do not hammer the TV in lockstep.
 */
class Backoff(
    private val baseMillis: Long = 500,
    private val maxMillis: Long = 15_000,
    private val random: Random = Random.Default,
) {
    var attempt = 0
        private set

    fun next(): Long {
        val exp = (baseMillis shl attempt.coerceAtMost(10)).coerceAtMost(maxMillis)
        attempt++
        val jitter = (exp * 0.2 * (random.nextDouble() * 2 - 1)).toLong()
        return (exp + jitter).coerceIn(baseMillis / 2, maxMillis)
    }

    fun reset() { attempt = 0 }
}
