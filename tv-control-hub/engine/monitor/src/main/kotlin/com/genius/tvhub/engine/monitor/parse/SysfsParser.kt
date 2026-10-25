package com.genius.tvhub.engine.monitor.parse

/** Kernel text files into numbers. Pure; every function returns null rather than guessing. */
object SysfsParser {
    /** scaling_cur_freq / cpuinfo_max_freq: a single integer in kHz. */
    fun khz(text: String?): Long? = text?.trim()?.toLongOrNull()?.takeIf { it > 0 }

    /** thermal_zone temp: millidegrees on most kernels, plain degrees on a few. */
    fun celsius(text: String?): Float? {
        val v = text?.trim()?.toLongOrNull() ?: return null
        val c = if (v > 1000) v / 1000f else v.toFloat()
        return c.takeIf { it in 1f..150f }
    }

    /** First "cpu " line of /proc/stat → (idle, total) jiffies. */
    fun cpuTimes(procStat: String?): Pair<Long, Long>? {
        val line = procStat?.lineSequence()?.firstOrNull { it.startsWith("cpu ") } ?: return null
        val v = line.split(Regex("\\s+")).drop(1).mapNotNull { it.toLongOrNull() }
        if (v.size < 4) return null
        val idle = v[3] + (v.getOrNull(4) ?: 0)
        return idle to v.sum()
    }

    fun load(before: Pair<Long, Long>, after: Pair<Long, Long>): Float? {
        val total = after.second - before.second
        val idle = after.first - before.first
        if (total <= 0) return null
        return (1f - idle.toFloat() / total).coerceIn(0f, 1f)
    }
}

/** Bytes counters into a per-second rate. Pure. */
class RateMeter {
    private var last = -1L
    private var at = 0L

    fun rate(counter: Long, nowMillis: Long): Long {
        val r = if (last < 0 || nowMillis <= at || counter < last) 0 else (counter - last) * 1000 / (nowMillis - at)
        last = counter; at = nowMillis
        return r
    }
}
