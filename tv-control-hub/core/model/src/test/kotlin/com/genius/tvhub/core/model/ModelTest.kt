package com.genius.tvhub.core.model

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class ModelTest {
    @Test fun defaultGrantsExcludeCommandExecution() {
        val g = Grants.DEFAULT
        assertThat(Grant.SCREEN in g).isTrue()
        assertThat(Grant.INPUT in g).isTrue()
        assertThat(Grant.SHELL in g).isFalse()
        assertThat(Grant.SERVICES in g).isFalse()
    }

    @Test fun grantsArithmetic() {
        val g = Grants.NONE + Grant.FILES_READ + Grant.APPS
        assertThat(g.toSet()).containsExactly(Grant.FILES_READ, Grant.APPS)
        assertThat((g - Grant.APPS).toSet()).containsExactly(Grant.FILES_READ)
        assertThat(Grants.ALL.toSet()).hasSize(Grant.entries.size)
    }

    @Test fun remotePathNavigation() {
        val root = RemotePath("shared")
        val movie = root.child("Movies").child("a.mp4")
        assertThat(movie.path).isEqualTo("Movies/a.mp4")
        assertThat(movie.name).isEqualTo("a.mp4")
        assertThat(movie.parent()).isEqualTo(RemotePath("shared", "Movies"))
        assertThat(movie.parent()!!.parent()).isEqualTo(root)
        assertThat(root.parent()).isNull()
    }

    @Test fun readingAvailability() {
        assertThat(Reading.of(3).isAvailable).isTrue()
        assertThat(Reading.unsupported<Int>("no api").isAvailable).isFalse()
        assertThat(Reading.needsAdb<Int>("blocked").availability).isInstanceOf(Availability.NeedsAdb::class.java)
    }

    @Test fun memoryFraction() {
        val m = MemoryReading(totalBytes = 2000, availableBytes = 500, lowMemory = false, thresholdBytes = 100)
        assertThat(m.usedBytes).isEqualTo(1500)
        assertThat(m.usedFraction).isWithin(1e-6f).of(0.75f)
    }
}
