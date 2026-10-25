package com.genius.tvhub.engine.apps

import com.genius.tvhub.engine.apps.catalog.CatalogMerger
import com.genius.tvhub.engine.apps.catalog.LaunchEntry
import com.genius.tvhub.engine.apps.icons.AccentExtractor
import com.genius.tvhub.engine.apps.install.InstallLedger
import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

class CatalogMergerTest {
    @Test fun phoneAppsAppearNextToTvApps() {
        val merged = CatalogMerger.merge(
            leanback = listOf(LaunchEntry("yt", "YouTube", false)),
            launcher = listOf(LaunchEntry("yt", "YouTube", false), LaunchEntry("brave", "Brave", false), LaunchEntry("me", "TV Hub", false)),
            hidden = setOf("me"),
        )
        assertThat(merged.map { it.packageName }).containsExactly("brave", "yt").inOrder()
        assertThat(merged.first { it.packageName == "yt" }.isTvApp).isTrue()
        assertThat(merged.first { it.packageName == "brave" }.isTvApp).isFalse()
    }

    @Test fun blankLabelsFallBackToPackage() {
        assertThat(CatalogMerger.merge(emptyList(), listOf(LaunchEntry("a.b", "  ", false)), emptySet()).single().label).isEqualTo("a.b")
    }
}

class AccentExtractorTest {
    private fun argb(r: Int, g: Int, b: Int, a: Int = 255) = (a shl 24) or (r shl 16) or (g shl 8) or b

    @Test fun redIconOnWhiteIsRed() {
        val pixels = IntArray(1024) { if (it % 3 == 0) argb(255, 255, 255) else argb(229, 57, 53) }
        val accent = AccentExtractor.accent(pixels)
        assertThat(accent shr 16 and 0xFF).isGreaterThan(200)
        assertThat(accent shr 8 and 0xFF).isLessThan(90)
    }

    @Test fun greyOrTransparentIconsUseFallback() {
        assertThat(AccentExtractor.accent(IntArray(1024) { argb(128, 128, 128) }, fallback = 7)).isEqualTo(7)
        assertThat(AccentExtractor.accent(IntArray(1024) { argb(255, 0, 0, a = 0) }, fallback = 7)).isEqualTo(7)
    }

    @Test fun dominantHueWinsOverSmallerAccent() {
        val pixels = IntArray(1000) { if (it < 700) argb(30, 120, 240) else argb(250, 200, 20) }
        val accent = AccentExtractor.accent(pixels)
        assertThat(accent and 0xFF).isGreaterThan(200) // blue
    }
}

class InstallLedgerTest {
    @Test fun acceptsInOrderChunksUntilComplete() {
        val l = InstallLedger(listOf(10, 5))
        l.accept(0, 0, 6); l.accept(0, 6, 4); l.accept(1, 0, 5)
        assertThat(l.complete).isTrue()
        assertThat(l.splitName(0)).isEqualTo("base.apk")
        assertThat(l.splitName(1)).isEqualTo("split_1.apk")
    }

    @Test fun rejectsGapsOverflowAndUnknownSplits() {
        val l = InstallLedger(listOf(10))
        assertThrows(IllegalArgumentException::class.java) { l.accept(0, 3, 2) }
        assertThrows(IllegalArgumentException::class.java) { l.accept(0, 0, 11) }
        assertThrows(IllegalArgumentException::class.java) { l.accept(1, 0, 1) }
        assertThat(l.complete).isFalse()
    }
}
