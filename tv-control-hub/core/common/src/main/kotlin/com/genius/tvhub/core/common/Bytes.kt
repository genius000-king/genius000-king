package com.genius.tvhub.core.common

import java.security.MessageDigest

private val HEX = "0123456789abcdef".toCharArray()

fun ByteArray.toHex(): String {
    val out = CharArray(size * 2)
    forEachIndexed { i, b ->
        out[i * 2] = HEX[(b.toInt() shr 4) and 0xF]
        out[i * 2 + 1] = HEX[b.toInt() and 0xF]
    }
    return String(out)
}

fun String.hexToBytes(): ByteArray {
    require(length % 2 == 0) { "odd hex length" }
    return ByteArray(length / 2) { i -> substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}

fun ByteArray.sha256(): ByteArray = MessageDigest.getInstance("SHA-256").digest(this)

/** Human-readable size: 1.5 GB, 820 KB. Units stay Latin so they read the same in both languages. */
fun formatBytes(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    val units = listOf("KB", "MB", "GB", "TB")
    var value = bytes.toDouble() / 1024
    var unit = 0
    while (value >= 1024 && unit < units.lastIndex) { value /= 1024; unit++ }
    return if (value >= 100) "%.0f %s".format(value, units[unit]) else "%.1f %s".format(value, units[unit])
}

/** 3d 4h, 2h 5m, 45s. */
fun formatDuration(millis: Long): String {
    val s = millis / 1000
    val d = s / 86_400; val h = (s % 86_400) / 3600; val m = (s % 3600) / 60
    return when {
        d > 0 -> "${d}d ${h}h"
        h > 0 -> "${h}h ${m}m"
        m > 0 -> "${m}m ${s % 60}s"
        else -> "${s}s"
    }
}
