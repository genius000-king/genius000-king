package com.tvhub.monitor.tv

import android.os.PowerManager
import java.util.Locale

/** Turns raw system values into text a person can read. */
internal object ProbeFormat {

    private const val BYTES_PER_GB = 1_000_000_000.0
    private const val MILLIS_PER_MINUTE = 60_000L
    private const val MINUTES_PER_HOUR = 60

    fun gigabytes(bytes: Long): String = String.format(Locale.ROOT, "%.2f GB", bytes / BYTES_PER_GB)

    fun uptime(millis: Long): String {
        val totalMinutes = millis / MILLIS_PER_MINUTE
        return String.format(
            Locale.ROOT,
            "%d س %02d د",
            totalMinutes / MINUTES_PER_HOUR,
            totalMinutes % MINUTES_PER_HOUR,
        )
    }

    fun yesNo(value: Boolean): String = if (value) "نعم" else "لا"

    fun thermal(status: Int): String = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> "طبيعي"
        PowerManager.THERMAL_STATUS_LIGHT -> "خفيف"
        PowerManager.THERMAL_STATUS_MODERATE -> "متوسط"
        PowerManager.THERMAL_STATUS_SEVERE -> "شديد"
        PowerManager.THERMAL_STATUS_CRITICAL -> "حرج"
        PowerManager.THERMAL_STATUS_EMERGENCY -> "طارئ"
        PowerManager.THERMAL_STATUS_SHUTDOWN -> "إيقاف"
        else -> "غير معروف"
    }
}
