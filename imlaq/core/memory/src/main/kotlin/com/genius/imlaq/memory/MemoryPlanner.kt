package com.genius.imlaq.memory

import com.genius.imlaq.common.Bytes
import com.genius.imlaq.common.maxOf
import com.genius.imlaq.common.minOf

/**
 * How hard the system is asking for memory back. The planner shrinks the whole budget by
 * [budgetFactor] instead of guessing which engine to squeeze — the grants then shrink with it.
 */
enum class MemoryPressure(val budgetFactor: Double) {
    NORMAL(1.0),
    ELEVATED(0.85),
    CRITICAL(0.6),
}

/** Who gets RAM first when there is not enough for everyone. Declared highest first. */
enum class EnginePriority {
    /** The engine the user is waiting on right now (the chat model mid-answer). */
    FOREGROUND,

    /** Engines that serve the foreground one (speech-in / speech-out around a voice chat). */
    ASSIST,

    /** Loaded but idle; first to be stopped. */
    BACKGROUND,
}

/**
 * What one engine asks for.
 *
 * [minimum] is the floor it cannot run below (for a streamed MoE: the dense weights + KV cache +
 * the runtime). [preferred] is the point past which more RAM buys nothing (the whole model
 * resident). Everything between the two is cache: useful, but negotiable.
 */
data class MemoryDemand(
    val engineId: String,
    val priority: EnginePriority,
    val minimum: Bytes,
    val preferred: Bytes,
) {
    init {
        require(minimum.value >= 0) { "minimum must be >= 0" }
        require(preferred >= minimum) { "preferred must be >= minimum" }
    }
}

/**
 * The memory picture at one instant.
 *
 * [available] is the system's own figure (it already counts reclaimable page cache as free).
 * [ownUsage] is what our engine processes hold right now: it is missing from [available] but is
 * ours to hand out again, so it goes back into the budget.
 */
data class MemorySnapshot(
    val total: Bytes,
    val available: Bytes,
    val ownUsage: Bytes = Bytes.ZERO,
)

/** The user's rule: "leave this much for the phone, whatever happens". */
data class MemoryPolicy(val systemReserve: Bytes) {
    companion object {
        /** 15% of the RAM, never less than 1.5 GiB — enough for the launcher and the keyboard. */
        fun defaultFor(total: Bytes) = MemoryPolicy(maxOf(Bytes.gib(1.5), total * 0.15))
    }
}

data class MemoryPlan(
    /** Everything the engines may use together. */
    val budget: Bytes,
    /** engineId → the RAM that engine may use. Engines missing here must not run. */
    val grants: Map<String, Bytes>,
    /** Lower-priority engines that have to stop so the higher ones fit. */
    val evicted: List<String>,
    /** Foreground engines whose minimum does not fit even after every eviction. */
    val unmet: List<String>,
) {
    val unused: Bytes get() = Bytes(budget.value - grants.values.sumOf { it.value })
}

/**
 * Splits one RAM budget across every engine that wants a share. Pure function, no Android:
 * the Android side feeds it snapshots and applies the plan (resizing caches, stopping engines).
 *
 * Two passes, both in priority order:
 *  1. every engine gets its [MemoryDemand.minimum], or is evicted (or reported unmet, if it is
 *     a foreground engine) — a lower priority never displaces a higher one;
 *  2. what is left is handed out as cache, up to each [MemoryDemand.preferred].
 */
class MemoryPlanner {

    fun budget(snapshot: MemorySnapshot, policy: MemoryPolicy, pressure: MemoryPressure): Bytes {
        val reclaimable = snapshot.available + snapshot.ownUsage
        val ceiling = snapshot.total - policy.systemReserve
        val raw = minOf(reclaimable - policy.systemReserve, ceiling).coerceAtLeastZero()
        return raw * pressure.budgetFactor
    }

    fun plan(
        snapshot: MemorySnapshot,
        policy: MemoryPolicy,
        pressure: MemoryPressure,
        demands: List<MemoryDemand>,
    ): MemoryPlan {
        val budget = budget(snapshot, policy, pressure)
        // sortedBy is stable: among equal priorities the caller's order (oldest first) wins.
        val ordered = demands.sortedBy { it.priority.ordinal }

        var left = budget
        val grants = LinkedHashMap<String, Bytes>()
        val evicted = mutableListOf<String>()
        val unmet = mutableListOf<String>()

        for (d in ordered) {
            if (d.minimum <= left) {
                grants[d.engineId] = d.minimum
                left -= d.minimum
            } else if (d.priority == EnginePriority.FOREGROUND) {
                unmet += d.engineId
            } else {
                evicted += d.engineId
            }
        }

        for (d in ordered) {
            val granted = grants[d.engineId] ?: continue
            if (left <= Bytes.ZERO) break
            val extra = minOf(d.preferred - granted, left)
            grants[d.engineId] = granted + extra
            left -= extra
        }

        return MemoryPlan(budget, grants, evicted, unmet)
    }
}
