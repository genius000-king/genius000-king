package com.genius.imlaq.device

import android.app.ActivityManager
import android.content.Context
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.memory.MemoryPressure
import com.genius.imlaq.memory.MemorySnapshot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import java.io.File

/**
 * Turns the system's memory state into a [MemoryPressure] the planner understands.
 *
 * Polling, not onTrimMemory: since Android 14 a foreground app no longer receives the
 * TRIM_MEMORY_RUNNING_* levels, which are exactly the ones that would matter mid-generation.
 * Where the kernel exposes PSI (/proc/pressure/memory) and SELinux lets us read it, the stall
 * figure sharpens the call; otherwise the available-vs-threshold ratio decides alone.
 */
class MemoryWatcher(
    private val context: Context,
    private val intervalMs: Long = 2_000,
) {

    data class Sample(val snapshot: MemorySnapshot, val pressure: MemoryPressure, val psiSomeAvg10: Double?)

    fun samples(): Flow<Sample> = flow {
        val am = context.getSystemService(ActivityManager::class.java)
        val info = ActivityManager.MemoryInfo()
        while (true) {
            am.getMemoryInfo(info)
            val psi = readPsiSomeAvg10()
            emit(
                Sample(
                    snapshot = MemorySnapshot(Bytes(info.totalMem), Bytes(info.availMem)),
                    pressure = classify(info.availMem, info.threshold, info.lowMemory, psi),
                    psiSomeAvg10 = psi,
                ),
            )
            delay(intervalMs)
        }
    }.flowOn(Dispatchers.IO)

    fun pressure(): Flow<MemoryPressure> = samples().map { it.pressure }.distinctUntilChanged()

    private fun readPsiSomeAvg10(): Double? = runCatching {
        // "some avg10=0.00 avg60=0.00 avg300=0.00 total=0"
        File("/proc/pressure/memory").useLines { lines ->
            lines.first { it.startsWith("some") }
                .split(' ')
                .first { it.startsWith("avg10=") }
                .removePrefix("avg10=")
                .toDouble()
        }
    }.getOrNull()

    companion object {
        fun classify(availMem: Long, threshold: Long, lowMemory: Boolean, psiSomeAvg10: Double?): MemoryPressure {
            val headroom = if (threshold > 0) availMem.toDouble() / threshold else Double.MAX_VALUE
            return when {
                lowMemory || headroom < 1.25 || (psiSomeAvg10 ?: 0.0) > 20.0 -> MemoryPressure.CRITICAL
                headroom < 2.0 || (psiSomeAvg10 ?: 0.0) > 5.0 -> MemoryPressure.ELEVATED
                else -> MemoryPressure.NORMAL
            }
        }
    }
}
