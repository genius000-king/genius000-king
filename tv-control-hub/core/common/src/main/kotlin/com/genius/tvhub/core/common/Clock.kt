package com.genius.tvhub.core.common

/** Wall and monotonic time behind an interface, so time-based logic is testable. */
interface Clock {
    fun nowMillis(): Long
    fun monotonicMillis(): Long

    object System : Clock {
        override fun nowMillis() = java.lang.System.currentTimeMillis()
        override fun monotonicMillis() = java.lang.System.nanoTime() / 1_000_000
    }
}
