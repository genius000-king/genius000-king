package com.genius.imlaq.memory

import com.genius.imlaq.common.Bytes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MemoryPlannerTest {

    private val planner = MemoryPlanner()
    private val phone12 = MemorySnapshot(total = Bytes.gib(12), available = Bytes.gib(8))
    private val reserve2 = MemoryPolicy(systemReserve = Bytes.gib(2))

    @Test
    fun budgetLeavesTheReserveForThePhone() {
        val budget = planner.budget(phone12, reserve2, MemoryPressure.NORMAL)
        assertEquals(Bytes.gib(6), budget)
    }

    @Test
    fun ownEnginesMemoryCountsAsOursToRedistribute() {
        val withEngine = phone12.copy(available = Bytes.gib(5), ownUsage = Bytes.gib(3))
        assertEquals(Bytes.gib(6), planner.budget(withEngine, reserve2, MemoryPressure.NORMAL))
    }

    @Test
    fun budgetNeverExceedsTotalMinusReserve() {
        val odd = MemorySnapshot(total = Bytes.gib(8), available = Bytes.gib(7), ownUsage = Bytes.gib(4))
        assertEquals(Bytes.gib(6), planner.budget(odd, reserve2, MemoryPressure.NORMAL))
    }

    @Test
    fun pressureShrinksTheBudget() {
        val budget = planner.budget(phone12, reserve2, MemoryPressure.CRITICAL)
        assertEquals(Bytes.gib(6) * 0.6, budget)
    }

    @Test
    fun foregroundGetsItsMinimumThenTheCache() {
        val chat = MemoryDemand("chat", EnginePriority.FOREGROUND, Bytes.gib(3), Bytes.gib(20))
        val plan = planner.plan(phone12, reserve2, MemoryPressure.NORMAL, listOf(chat))
        assertEquals(Bytes.gib(6), plan.grants["chat"])
        assertEquals(Bytes.ZERO, plan.unused)
    }

    @Test
    fun lowerPriorityIsEvictedRatherThanStarvingTheForeground() {
        val chat = MemoryDemand("chat", EnginePriority.FOREGROUND, Bytes.gib(5), Bytes.gib(20))
        val idleImage = MemoryDemand("image", EnginePriority.BACKGROUND, Bytes.gib(3), Bytes.gib(3))
        val plan = planner.plan(phone12, reserve2, MemoryPressure.NORMAL, listOf(idleImage, chat))
        assertEquals(listOf("image"), plan.evicted)
        assertEquals(Bytes.gib(6), plan.grants["chat"])
    }

    @Test
    fun assistEnginesKeepTheirMinimumBeforeTheForegroundCacheGrows() {
        val chat = MemoryDemand("chat", EnginePriority.FOREGROUND, Bytes.gib(3), Bytes.gib(20))
        val stt = MemoryDemand("stt", EnginePriority.ASSIST, Bytes.gib(1), Bytes.gib(1))
        val plan = planner.plan(phone12, reserve2, MemoryPressure.NORMAL, listOf(chat, stt))
        assertEquals(Bytes.gib(1), plan.grants["stt"])
        assertEquals(Bytes.gib(5), plan.grants["chat"])
    }

    @Test
    fun foregroundThatCannotFitIsReportedNotSilentlyDropped() {
        val giant = MemoryDemand("giant", EnginePriority.FOREGROUND, Bytes.gib(9), Bytes.gib(90))
        val plan = planner.plan(phone12, reserve2, MemoryPressure.NORMAL, listOf(giant))
        assertEquals(listOf("giant"), plan.unmet)
        assertTrue(plan.grants.isEmpty())
    }

    @Test
    fun defaultReserveIsAtLeastOneAndAHalfGib() {
        assertEquals(Bytes.gib(1.5), MemoryPolicy.defaultFor(Bytes.gib(6)).systemReserve)
        assertEquals(Bytes.gib(16) * 0.15, MemoryPolicy.defaultFor(Bytes.gib(16)).systemReserve)
    }
}
