package com.genius.imlaq.common

import java.util.Locale

/**
 * A byte count. Every size in the app (RAM, model files, caches) travels as [Bytes] so a MiB is
 * never mistaken for a MB and a budget is never compared against a raw Long of unknown unit.
 */
@JvmInline
value class Bytes(val value: Long) : Comparable<Bytes> {

    val kib: Double get() = value / KIB.toDouble()
    val mib: Double get() = value / MIB.toDouble()
    val gib: Double get() = value / GIB.toDouble()

    /** Whole MiB, rounded down — the unit the engines take on their command line. */
    val wholeMib: Long get() = value / MIB

    operator fun plus(other: Bytes) = Bytes(value + other.value)
    operator fun minus(other: Bytes) = Bytes(value - other.value)
    operator fun times(factor: Double) = Bytes((value * factor).toLong())
    operator fun div(divisor: Int) = Bytes(value / divisor)

    override fun compareTo(other: Bytes) = value.compareTo(other.value)

    fun coerceAtLeastZero() = if (value < 0) ZERO else this

    override fun toString(): String = when {
        value >= GIB -> String.format(Locale.US, "%.1f GiB", gib)
        value >= MIB -> String.format(Locale.US, "%.0f MiB", mib)
        value >= KIB -> String.format(Locale.US, "%.0f KiB", kib)
        else -> "$value B"
    }

    companion object {
        private const val KIB = 1024L
        private const val MIB = KIB * 1024
        private const val GIB = MIB * 1024

        val ZERO = Bytes(0)

        fun kib(n: Long) = Bytes(n * KIB)
        fun mib(n: Long) = Bytes(n * MIB)
        fun gib(n: Long) = Bytes(n * GIB)
        fun gib(n: Double) = Bytes((n * GIB).toLong())
    }
}

fun Iterable<Bytes>.sum(): Bytes = fold(Bytes.ZERO) { acc, b -> acc + b }

fun minOf(a: Bytes, b: Bytes): Bytes = if (a <= b) a else b

fun maxOf(a: Bytes, b: Bytes): Bytes = if (a >= b) a else b
