package com.genius.saraat.data

import java.util.Locale

private fun num(v: Double, decimals: Int): String = String.format(Locale.US, "%.${decimals}f", v)

/**
 * The UI is right-to-left, where a plain "944 Kbps" would be displayed as "Kbps 944".
 * Wrapping numbers-with-units in left-to-right marks keeps them reading the way they are written.
 */
private fun ltr(text: String): String = "\u200E$text\u200E"

/** Data volume: 1 KB = 1000 B, like Android's own data-usage screen. */
fun formatBytes(bytes: Long): String = ltr(rawBytes(bytes))

private fun rawBytes(bytes: Long): String = when {
    bytes < 1_000 -> "$bytes B"
    bytes < 1_000_000 -> "${num(bytes / 1e3, if (bytes < 10_000) 1 else 0)} KB"
    bytes < 1_000_000_000 -> "${num(bytes / 1e6, if (bytes < 10_000_000) 2 else 1)} MB"
    else -> "${num(bytes / 1e9, 2)} GB"
}

/** Speed in bits per second, the way internet plans are sold. */
fun formatRate(bytesPerSec: Long): String = ltr(rawRate(bytesPerSec))

private fun rawRate(bytesPerSec: Long): String {
    val bits = bytesPerSec * 8.0
    return when {
        bits < 1_000 -> "${bits.toLong()} bps"
        bits < 1_000_000 -> "${num(bits / 1e3, if (bits < 10_000) 1 else 0)} Kbps"
        else -> "${num(bits / 1e6, if (bits < 10_000_000) 2 else 1)} Mbps"
    }
}

/** A configured limit, e.g. 512 -> "512 Kbps", 1000 -> "1 Mbps", 2500 -> "2.5 Mbps". */
fun formatLimit(kbps: Int): String = ltr(rawLimit(kbps))

private fun rawLimit(kbps: Int): String =
    if (kbps < 1000) "$kbps Kbps"
    else if (kbps % 1000 == 0) "${kbps / 1000} Mbps"
    else "${num(kbps / 1000.0, 2).trimEnd('0').trimEnd('.')} Mbps"

/** Splits a limit into a big number and a unit for the main dial. */
fun limitParts(kbps: Int): Pair<String, String> =
    if (kbps < 1000) kbps.toString() to "Kbps"
    else if (kbps % 1000 == 0) (kbps / 1000).toString() to "Mbps"
    else num(kbps / 1000.0, 2).trimEnd('0').trimEnd('.') to "Mbps"
