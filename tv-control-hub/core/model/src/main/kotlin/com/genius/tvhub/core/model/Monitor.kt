package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

/**
 * Whether a reading exists on this device, and if not, why. The UI shows the reason instead of
 * inventing a number.
 */
@Serializable
sealed interface Availability {
    @Serializable data object Available : Availability
    /** Android blocks it for apps; reachable through ADB shell only. */
    @Serializable data class NeedsAdb(val reason: String) : Availability
    @Serializable data class Unsupported(val reason: String) : Availability
}

@Serializable
data class Reading<T>(val value: T? = null, val availability: Availability = Availability.Available) {
    val isAvailable get() = availability == Availability.Available && value != null

    companion object {
        fun <T> of(value: T) = Reading(value, Availability.Available)
        fun <T> unsupported(reason: String) = Reading<T>(null, Availability.Unsupported(reason))
        fun <T> needsAdb(reason: String) = Reading<T>(null, Availability.NeedsAdb(reason))
    }
}

/** Facts that do not change while the TV runs. Sent once per connection. */
@Serializable
data class DeviceProfile(
    val manufacturer: String,
    val model: String,
    val androidVersion: String,
    val sdkInt: Int,
    val securityPatch: String,
    val socModel: Reading<String>,
    val abis: List<String>,
    val cpuCores: Int,
    val cpuMaxFreqKhz: Reading<List<Long>>,
    val gpuRenderer: Reading<String>,
    val gpuVendor: Reading<String>,
    val glVersion: Reading<String>,
    val displayWidth: Int,
    val displayHeight: Int,
    val refreshRate: Float,
    val totalRamBytes: Long,
)

@Serializable
data class MemoryReading(val totalBytes: Long, val availableBytes: Long, val lowMemory: Boolean, val thresholdBytes: Long) {
    val usedBytes get() = totalBytes - availableBytes
    val usedFraction get() = if (totalBytes == 0L) 0f else usedBytes.toFloat() / totalBytes
}

@Serializable
data class StorageReading(val id: String, val label: String, val totalBytes: Long, val freeBytes: Long, val removable: Boolean) {
    val usedFraction get() = if (totalBytes == 0L) 0f else (totalBytes - freeBytes).toFloat() / totalBytes
}

@Serializable
data class CpuReading(
    val curFreqKhz: Reading<List<Long>>,
    /** Whole-system CPU load. Android 8+ blocks /proc/stat for apps, so normally unavailable. */
    val loadFraction: Reading<Float>,
    /** CPU time of this app's own process, always readable. */
    val appCpuFraction: Float,
)

enum class ThermalLevel { NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN }

@Serializable
data class ThermalReading(val level: Reading<ThermalLevel>, val headroom: Reading<Float>, val celsius: Reading<Float>)

enum class LinkKind { WIFI, ETHERNET, OTHER, NONE }

@Serializable
data class NetworkReading(
    val kind: LinkKind,
    val addresses: List<String>,
    val wifiRssiDbm: Reading<Int>,
    val linkSpeedMbps: Reading<Int>,
    val rxBytesPerSec: Long,
    val txBytesPerSec: Long,
)

@Serializable
data class MetricsSnapshot(
    val timestamp: Long,
    val uptimeMillis: Long,
    val memory: MemoryReading,
    val storage: List<StorageReading>,
    val cpu: CpuReading,
    val thermal: ThermalReading,
    val network: NetworkReading,
    val appMemoryBytes: Long,
)
