package com.genius.tvhub.core.common

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class BytesTest {
    @Test fun hexRoundTrip() {
        val bytes = byteArrayOf(0, 1, 127, -128, -1)
        assertThat(bytes.toHex()).isEqualTo("00017f80ff")
        assertThat("00017f80ff".hexToBytes()).isEqualTo(bytes)
    }

    @Test fun sha256KnownVector() {
        assertThat("abc".toByteArray().sha256().toHex())
            .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    @Test fun formatsSizes() {
        assertThat(formatBytes(512)).isEqualTo("512 B")
        assertThat(formatBytes(1536)).isEqualTo("1.5 KB")
        assertThat(formatBytes(2L * 1024 * 1024 * 1024)).isEqualTo("2.0 GB")
        assertThat(formatBytes(300L * 1024 * 1024)).isEqualTo("300 MB")
    }

    @Test fun formatsDurations() {
        assertThat(formatDuration(45_000)).isEqualTo("45s")
        assertThat(formatDuration(125_000)).isEqualTo("2m 5s")
        assertThat(formatDuration(3_600_000L * 26 + 60_000)).isEqualTo("1d 2h")
    }
}
