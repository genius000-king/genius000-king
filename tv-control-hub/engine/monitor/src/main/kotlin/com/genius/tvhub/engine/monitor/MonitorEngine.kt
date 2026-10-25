package com.genius.tvhub.engine.monitor

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.TrafficStats
import android.net.wifi.WifiInfo
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.Process
import android.os.StatFs
import android.os.SystemClock
import android.os.storage.StorageManager
import android.view.WindowManager
import com.genius.tvhub.core.model.CapabilityCheck
import com.genius.tvhub.core.model.Capability
import com.genius.tvhub.core.model.CheckState
import com.genius.tvhub.core.model.CpuReading
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.LinkKind
import com.genius.tvhub.core.model.MemoryReading
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.NetworkReading
import com.genius.tvhub.core.model.Reading
import com.genius.tvhub.core.model.StorageReading
import com.genius.tvhub.core.model.ThermalLevel
import com.genius.tvhub.core.model.ThermalReading
import com.genius.tvhub.engine.monitor.collect.GpuProbe
import com.genius.tvhub.engine.monitor.collect.SysFs
import com.genius.tvhub.engine.monitor.parse.RateMeter
import com.genius.tvhub.engine.monitor.parse.SysfsParser
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.net.NetworkInterface

/**
 * What Android actually lets an app read about the device, and nothing invented. Every reading
 * that is blocked or missing says so (see [Reading]).
 */
class MonitorEngine(private val context: Context, private val sys: SysFs = SysFs.Real) {
    private val am = context.getSystemService(ActivityManager::class.java)
    private val power = context.getSystemService(PowerManager::class.java)
    private val cores = Runtime.getRuntime().availableProcessors()
    private val rx = RateMeter(); private val tx = RateMeter()
    private var lastCpu: Pair<Long, Long>? = null
    private var lastAppCpu = Process.getElapsedCpuTime() to SystemClock.elapsedRealtime()
    private val gpu by lazy { GpuProbe.probe() }

    fun profile(): DeviceProfile {
        val mem = ActivityManager.MemoryInfo().also(am::getMemoryInfo)
        val bounds = if (Build.VERSION.SDK_INT >= 30) context.getSystemService(WindowManager::class.java).maximumWindowMetrics.bounds.let { it.width() to it.height() }
        else context.resources.displayMetrics.let { it.widthPixels to it.heightPixels }
        @Suppress("DEPRECATION")
        val refresh = context.getSystemService(WindowManager::class.java).defaultDisplay.refreshRate
        val maxFreq = (0 until cores).map { SysfsParser.khz(sys.read("/sys/devices/system/cpu/cpu$it/cpufreq/cpuinfo_max_freq")) }
        val g = gpu
        return DeviceProfile(
            manufacturer = Build.MANUFACTURER, model = Build.MODEL, androidVersion = Build.VERSION.RELEASE, sdkInt = Build.VERSION.SDK_INT,
            securityPatch = Build.VERSION.SECURITY_PATCH,
            socModel = if (Build.VERSION.SDK_INT >= 31 && Build.SOC_MODEL != Build.UNKNOWN) Reading.of("${Build.SOC_MANUFACTURER} ${Build.SOC_MODEL}") else Reading.unsupported("Android 12+ reports the chip name"),
            abis = Build.SUPPORTED_ABIS.toList(), cpuCores = cores,
            cpuMaxFreqKhz = if (maxFreq.all { it != null }) Reading.of(maxFreq.map { it!! }) else Reading.unsupported("this kernel hides CPU frequencies"),
            gpuRenderer = g?.let { Reading.of(it.renderer) } ?: Reading.unsupported("no GL context"),
            gpuVendor = g?.let { Reading.of(it.vendor) } ?: Reading.unsupported("no GL context"),
            glVersion = g?.let { Reading.of(it.version) } ?: Reading.unsupported("no GL context"),
            displayWidth = bounds.first, displayHeight = bounds.second, refreshRate = refresh, totalRamBytes = mem.totalMem,
        )
    }

    fun snapshot(): MetricsSnapshot {
        val now = SystemClock.elapsedRealtime()
        val mem = ActivityManager.MemoryInfo().also(am::getMemoryInfo)
        return MetricsSnapshot(
            timestamp = System.currentTimeMillis(),
            uptimeMillis = now,
            memory = MemoryReading(mem.totalMem, mem.availMem, mem.lowMemory, mem.threshold),
            storage = storage(),
            cpu = cpu(now),
            thermal = thermal(),
            network = network(now),
            appMemoryBytes = am.getProcessMemoryInfo(intArrayOf(Process.myPid())).firstOrNull()?.totalPss?.toLong()?.times(1024) ?: 0,
        )
    }

    /** One snapshot per [periodMillis], only while collected: no cost when nobody looks. */
    fun metrics(periodMillis: Long = 1_000): Flow<MetricsSnapshot> = flow {
        while (true) { emit(snapshot()); delay(periodMillis) }
    }

    fun checks(): List<CapabilityCheck> {
        val freq = SysfsParser.khz(sys.read("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")) != null
        val stat = SysfsParser.cpuTimes(sys.read("/proc/stat")) != null
        return listOf(
            CapabilityCheck(Capability.CPU_FREQ, if (freq) CheckState.OK else CheckState.UNSUPPORTED),
            CapabilityCheck(Capability.CPU_LOAD, if (stat) CheckState.OK else CheckState.UNSUPPORTED, "/proc/stat"),
            CapabilityCheck(Capability.THERMAL, if (Build.VERSION.SDK_INT >= 29) CheckState.OK else CheckState.UNSUPPORTED),
        )
    }

    private fun storage(): List<StorageReading> {
        val list = mutableListOf<StorageReading>()
        val data = StatFs(Environment.getDataDirectory().path)
        list += StorageReading("internal", "Internal", data.totalBytes, data.availableBytes, false)
        if (Build.VERSION.SDK_INT >= 30) {
            context.getSystemService(StorageManager::class.java).storageVolumes.filter { it.isRemovable }.forEach { v ->
                val dir = v.directory ?: return@forEach
                runCatching { StatFs(dir.path) }.getOrNull()?.let { list += StorageReading(v.uuid ?: dir.name, v.getDescription(context), it.totalBytes, it.availableBytes, true) }
            }
        }
        return list
    }

    private fun cpu(now: Long): CpuReading {
        val freqs = (0 until cores).map { SysfsParser.khz(sys.read("/sys/devices/system/cpu/cpu$it/cpufreq/scaling_cur_freq")) }
        val times = SysfsParser.cpuTimes(sys.read("/proc/stat"))
        val load = times?.let { t -> lastCpu?.let { SysfsParser.load(it, t) }.also { lastCpu = t } }
        val appCpu = Process.getElapsedCpuTime()
        val appFraction = ((appCpu - lastAppCpu.first).toFloat() / ((now - lastAppCpu.second).coerceAtLeast(1) * cores)).coerceIn(0f, 1f)
        lastAppCpu = appCpu to now
        return CpuReading(
            curFreqKhz = if (freqs.all { it != null }) Reading.of(freqs.map { it!! }) else Reading.unsupported("this kernel hides CPU frequencies"),
            loadFraction = when {
                load != null -> Reading.of(load)
                times != null -> Reading.unsupported("measuring…")
                else -> Reading.needsAdb("Android 8+ blocks /proc/stat for apps")
            },
            appCpuFraction = appFraction,
        )
    }

    private fun thermal(): ThermalReading {
        val level = if (Build.VERSION.SDK_INT >= 29) Reading.of(ThermalLevel.entries[power.currentThermalStatus.coerceIn(0, ThermalLevel.entries.lastIndex)]) else Reading.unsupported("Android 10+")
        val headroom = if (Build.VERSION.SDK_INT >= 30) power.getThermalHeadroom(10).takeIf { !it.isNaN() }?.let { Reading.of(it) } ?: Reading.unsupported("not reported by this device") else Reading.unsupported("Android 11+")
        val temp = (0 until 10).firstNotNullOfOrNull { SysfsParser.celsius(sys.read("/sys/class/thermal/thermal_zone$it/temp")) }
        return ThermalReading(level, headroom, temp?.let { Reading.of(it) } ?: Reading.needsAdb("thermal zones are not readable by apps"))
    }

    private fun network(now: Long): NetworkReading {
        val cm = context.getSystemService(ConnectivityManager::class.java)
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val kind = when {
            caps == null -> LinkKind.NONE
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> LinkKind.WIFI
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> LinkKind.ETHERNET
            else -> LinkKind.OTHER
        }
        val wifi = if (Build.VERSION.SDK_INT >= 29) caps?.transportInfo as? WifiInfo else null
        val addresses = runCatching {
            NetworkInterface.getNetworkInterfaces().toList().filter { it.isUp && !it.isLoopback }
                .flatMap { it.inetAddresses.toList() }.mapNotNull { it.hostAddress?.substringBefore('%') }.filter { !it.startsWith("fe80") }
        }.getOrDefault(emptyList())
        return NetworkReading(
            kind, addresses,
            wifiRssiDbm = wifi?.rssi?.takeIf { it > -127 }?.let { Reading.of(it) } ?: Reading.unsupported("not on Wi-Fi"),
            linkSpeedMbps = wifi?.linkSpeed?.takeIf { it > 0 }?.let { Reading.of(it) } ?: Reading.unsupported("not on Wi-Fi"),
            rxBytesPerSec = rx.rate(TrafficStats.getTotalRxBytes(), now),
            txBytesPerSec = tx.rate(TrafficStats.getTotalTxBytes(), now),
        )
    }
}
