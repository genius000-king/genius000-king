package com.genius.imlaq.device

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.memory.MemorySnapshot
import java.io.File

data class CpuCore(val id: Int, val maxFreqKHz: Long)

data class DeviceProfile(
    val manufacturer: String,
    val model: String,
    /** e.g. "SM8750" on a Snapdragon 8 Elite; null before Android 12. */
    val socModel: String?,
    val socManufacturer: String?,
    val sdkInt: Int,
    val abis: List<String>,
    val cores: List<CpuCore>,
    val memory: MemorySnapshot,
    val lowMemoryThreshold: Bytes,
    val modelStorageFree: Bytes,
    /**
     * 0 = cool, 1 = the point where the OS starts throttling. Null when the device does not
     * report it (before Android 11, or a vendor that leaves it unimplemented).
     */
    val thermalHeadroom: Float?,
) {
    /**
     * The fast cores. Decode is bound by the slowest thread in the pool, so running on the little
     * cores too usually makes it slower, not faster — the engine's thread count defaults to this.
     */
    val performanceCores: List<CpuCore>
        get() {
            val top = cores.maxOfOrNull { it.maxFreqKHz } ?: return cores
            return cores.filter { it.maxFreqKHz >= top * 0.7 }
        }

    val isSnapdragon: Boolean
        get() = socManufacturer?.contains("qti", ignoreCase = true) == true ||
            socModel?.startsWith("SM") == true
}

class DeviceProfiler(private val context: Context) {

    fun profile(modelsDir: File = context.filesDir): DeviceProfile {
        val am = context.getSystemService(ActivityManager::class.java)
        val info = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        return DeviceProfile(
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            socModel = if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else null,
            socManufacturer = if (Build.VERSION.SDK_INT >= 31) Build.SOC_MANUFACTURER else null,
            sdkInt = Build.VERSION.SDK_INT,
            abis = Build.SUPPORTED_ABIS.toList(),
            cores = readCores(),
            memory = MemorySnapshot(total = Bytes(info.totalMem), available = Bytes(info.availMem)),
            lowMemoryThreshold = Bytes(info.threshold),
            modelStorageFree = runCatching { Bytes(StatFs(modelsDir.path).availableBytes) }
                .getOrDefault(Bytes.ZERO),
            thermalHeadroom = thermalHeadroom(),
        )
    }

    fun thermalHeadroom(): Float? {
        if (Build.VERSION.SDK_INT < 30) return null
        val pm = context.getSystemService(PowerManager::class.java)
        return pm.getThermalHeadroom(10).takeUnless { it.isNaN() }
    }

    private fun readCores(): List<CpuCore> {
        val cpuDir = File("/sys/devices/system/cpu")
        val ids = cpuDir.listFiles { f -> f.name.matches(Regex("cpu\\d+")) }
            ?.map { it.name.removePrefix("cpu").toInt() }
            ?.sorted()
            ?: return List(Runtime.getRuntime().availableProcessors()) { CpuCore(it, 0) }
        return ids.map { id ->
            val freq = runCatching {
                File(cpuDir, "cpu$id/cpufreq/cpuinfo_max_freq").readText().trim().toLong()
            }.getOrDefault(0L)
            CpuCore(id, freq)
        }
    }
}
