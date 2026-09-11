package io.nawah.linux.ui.util

import java.util.Locale

private const val KB = 1024.0
private const val MB = KB * 1024
private const val GB = MB * 1024

/**
 * Human byte sizes. Binary units, because that is what `df` inside the guest
 * will report and a user comparing the two should see the same number.
 *
 * Pure and context-free so it can be unit-tested on the JVM and called from a
 * `@Preview`.
 */
fun formatBytes(bytes: Long, locale: Locale = Locale.getDefault()): String = when {
    bytes < 0 -> "—"
    bytes < KB -> String.format(locale, "%d B", bytes)
    bytes < MB -> String.format(locale, "%.0f KB", bytes / KB)
    bytes < GB -> String.format(locale, "%.0f MB", bytes / MB)
    bytes < 10 * GB -> String.format(locale, "%.1f GB", bytes / GB)
    else -> String.format(locale, "%.0f GB", bytes / GB)
}

/** "1920 × 1080" — the multiplication sign, not a lowercase x. */
fun formatResolution(width: Int, height: Int): String = "$width × $height"
