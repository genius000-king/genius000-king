package com.tvhub.monitor.tv

import android.app.ActivityManager
import android.content.ContentResolver
import android.content.Context
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import com.tvhub.common.LocalAddress
import com.tvhub.protocol.StreamProfile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

/**
 * Reads what this device actually exposes to an app without root, and reports each fact as found.
 * Nothing is estimated: a file that the system blocks is reported as blocked.
 */
object CapabilityProbe {

    private val encoderTypes = listOf(
        "video/avc" to "H.264 (AVC)",
        "video/hevc" to "H.265 (HEVC)",
        "video/x-vnd.on2.vp8" to "VP8",
        "video/x-vnd.on2.vp9" to "VP9",
        "video/av01" to "AV1",
    )

    private const val UNSET = -1
    private const val ENABLED = 1

    suspend fun run(context: Context): ProbeReport = withContext(Dispatchers.IO) {
        ProbeReport(
            sections = listOf(
                device(),
                cpuAndMemory(context),
                encoders(),
                storage(),
                network(),
                security(context),
            ),
        )
    }

    private fun device() = ProbeSection(
        title = "الجهاز",
        items = listOf(
            ProbeItem("الشركة / الموديل", "${Build.MANUFACTURER} / ${Build.MODEL}"),
            ProbeItem("الإصدار", "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})"),
            ProbeItem("المعماريات", Build.SUPPORTED_ABIS.joinToString()),
            ProbeItem("مدة التشغيل", ProbeFormat.uptime(SystemClock.elapsedRealtime())),
        ),
    )

    private fun cpuAndMemory(context: Context): ProbeSection {
        val activityManager = context.getSystemService(ActivityManager::class.java)
        val memory = ActivityManager.MemoryInfo().also { activityManager.getMemoryInfo(it) }
        val thermal = context.getSystemService(PowerManager::class.java).currentThermalStatus

        return ProbeSection(
            title = "المعالج والذاكرة",
            items = listOf(
                ProbeItem("عدد الأنوية", Runtime.getRuntime().availableProcessors().toString()),
                ProbeItem("الذاكرة الكلية", ProbeFormat.gigabytes(memory.totalMem)),
                ProbeItem("الذاكرة المتاحة", ProbeFormat.gigabytes(memory.availMem)),
                ProbeItem("وضع ذاكرة منخفضة", ProbeFormat.yesNo(activityManager.isLowRamDevice)),
                ProbeItem("قراءة /proc/stat (حمل المعالج)", readability("/proc/stat")),
                ProbeItem("قراءة /proc/meminfo", readability("/proc/meminfo")),
                ProbeItem("قراءة تردد المعالج", readability(CPU_FREQ_PATH)),
                ProbeItem("الحالة الحرارية", ProbeFormat.thermal(thermal)),
            ),
        )
    }

    /** Lists the encoders of each codec, split into hardware and software, and checks the streaming profile. */
    private fun encoders(): ProbeSection {
        val infos = MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.filter { it.isEncoder }
        val items = encoderTypes.map { (mime, label) ->
            ProbeItem(label, encoderSummary(mime, infos.filter { mime in it.supportedTypes }))
        }
        return ProbeSection(title = "الترميز (المشفّرات)", items = items)
    }

    private fun encoderSummary(mime: String, matching: List<MediaCodecInfo>): String {
        if (matching.isEmpty()) return "غير متاح"
        val hardware = matching.filter { it.isHardwareAccelerated }.map { it.name }
        val software = matching.filterNot { it.isHardwareAccelerated }.map { it.name }
        val supportsProfile = matching.any { info ->
            info.getCapabilitiesForType(mime).videoCapabilities?.areSizeAndRateSupported(
                StreamProfile.WIDTH,
                StreamProfile.HEIGHT,
                StreamProfile.FPS.toDouble(),
            ) == true
        }
        val profile = "${StreamProfile.HEIGHT}p${StreamProfile.FPS}"
        val parts = buildList {
            if (hardware.isNotEmpty()) add("عتادي: ${hardware.joinToString()}")
            if (software.isNotEmpty()) add("برمجي: ${software.joinToString()}")
            add(if (supportsProfile) "$profile ✓" else "$profile ✗")
        }
        return parts.joinToString(" · ")
    }

    private fun storage(): ProbeSection {
        val stat = StatFs(Environment.getDataDirectory().path)
        return ProbeSection(
            title = "التخزين",
            items = listOf(
                ProbeItem("الكلي", ProbeFormat.gigabytes(stat.totalBytes)),
                ProbeItem("المتاح", ProbeFormat.gigabytes(stat.availableBytes)),
            ),
        )
    }

    private fun network(): ProbeSection = ProbeSection(
        title = "الشبكة",
        items = listOf(ProbeItem("عنوان IPv4 المحلي", LocalAddress.ipv4() ?: "غير متاح")),
    )

    private fun security(context: Context): ProbeSection {
        val resolver = context.contentResolver
        return ProbeSection(
            title = "الأمان والتصحيح",
            items = listOf(
                ProbeItem("تصحيح ADB (USB/شبكة)", settingState(resolver, "adb_enabled")),
                ProbeItem("ADB لاسلكي", settingState(resolver, "adb_wifi_enabled")),
            ),
        )
    }

    private fun settingState(resolver: ContentResolver, key: String): String = try {
        when (Settings.Global.getInt(resolver, key, UNSET)) {
            UNSET -> "غير معروف"
            ENABLED -> "مفعّل"
            else -> "غير مفعّل"
        }
    } catch (denied: SecurityException) {
        "محجوب (${denied.javaClass.simpleName})"
    }

    private fun readability(path: String): String = try {
        File(path).bufferedReader().use { it.readLine() }
        "متاح"
    } catch (denied: IOException) {
        "محجوب (${denied.javaClass.simpleName})"
    } catch (denied: SecurityException) {
        "محجوب (${denied.javaClass.simpleName})"
    }

    private const val CPU_FREQ_PATH = "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"
}
