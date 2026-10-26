package com.genius.tvhub.engine.apps.install

import java.io.File
import java.util.zip.ZipFile

/**
 * Will this APK's native code run here? Many phone apps ship only 64-bit libraries, and many TV
 * boxes run a 32-bit-only Android: Android then refuses with a bare INSTALL_FAILED_NO_MATCHING_ABIS.
 * This says why, before the install starts, in words the user can act on.
 */
object AbiCheck {
    /** ABIs an APK carries native code for (`lib/<abi>/...`); empty = pure Java/Kotlin, runs anywhere. */
    fun abisOf(entryNames: Sequence<String>): Set<String> =
        entryNames.filter { it.startsWith("lib/") && it.endsWith(".so") }.mapNotNull { it.split('/').getOrNull(1) }.toSet()

    fun abisOf(apks: List<File>): Set<String> = apks.flatMap { f ->
        runCatching { ZipFile(f).use { z -> abisOf(z.entries().asSequence().map { it.name }).toList() } }.getOrDefault(emptyList())
    }.toSet()

    /** Null when it runs here; otherwise what the APK needs. */
    fun mismatch(apkAbis: Set<String>, deviceAbis: List<String>): Set<String>? =
        if (apkAbis.isEmpty() || apkAbis.any { it in deviceAbis }) null else apkAbis

    /** A readable reason for a failed install, when Android's own message is a code. */
    fun explain(message: String, deviceAbis: List<String>): String = when {
        "NO_MATCHING_ABIS" in message -> needs(setOf("arm64-v8a"), deviceAbis)
        "OLDER_SDK" in message || "INSTALL_FAILED_DEPRECATED_SDK_VERSION" in message -> "This app needs a newer Android than this TV has"
        "UPDATE_INCOMPATIBLE" in message || "INCONSISTENT_CERTIFICATES" in message -> "A different build of this app is installed; uninstall it first"
        "INSUFFICIENT_STORAGE" in message -> "The TV is out of storage"
        else -> message
    }

    fun needs(apkAbis: Set<String>, deviceAbis: List<String>): String {
        val wants64 = apkAbis.any { "64" in it }
        val has64 = deviceAbis.any { "64" in it }
        return if (wants64 && !has64) "This app is 64-bit only; this TV runs 32-bit apps only (${deviceAbis.joinToString()})"
        else "This app is built for ${apkAbis.joinToString()}; this TV runs ${deviceAbis.joinToString()}"
    }
}
