package com.genius.tvhub.engine.stream.quality

/**
 * Adapts bitrate to the network without a quality button: when frames queue up on the way out
 * (Wi-Fi is struggling) cut by 25% at once; after five calm seconds, add 10% back, up to the
 * target. Additive-increase / multiplicative-decrease, like TCP.
 */
class BitrateController(private val target: Int, private val floor: Int = 400_000) {
    var current = target
        private set
    private var calmSince = -1L

    /** @param queued packets waiting to be sent. Returns the new bitrate if it changed. */
    fun onSample(queued: Int, nowMillis: Long): Int? {
        if (queued >= CONGESTED) {
            calmSince = -1
            val next = (current * 0.75).toInt().coerceAtLeast(floor)
            return next.takeIf { it != current }?.also { current = it }
        }
        if (queued > CALM) { calmSince = -1; return null }
        if (calmSince < 0) calmSince = nowMillis
        if (nowMillis - calmSince >= 5_000 && current < target) {
            calmSince = nowMillis
            current = (current * 1.10).toInt().coerceAtMost(target)
            return current
        }
        return null
    }

    companion object {
        const val CONGESTED = 8
        const val CALM = 2
    }
}
