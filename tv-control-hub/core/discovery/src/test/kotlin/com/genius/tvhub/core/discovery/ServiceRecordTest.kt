package com.genius.tvhub.core.discovery

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class ServiceRecordTest {
    private val id = "a".repeat(64)

    @Test fun txtRoundTrip() {
        val r = ServiceRecord(id, "تلفزيون الصالة", 1)
        val txt = r.toTxt().mapValues { it.value.toByteArray() }
        assertThat(ServiceRecord.fromTxt(txt, "ignored")).isEqualTo(r)
    }

    @Test fun rejectsForeignOrBrokenRecords() {
        assertThat(ServiceRecord.fromTxt(mapOf("id" to "xyz".toByteArray(), "v" to "1".toByteArray()), "x")).isNull()
        assertThat(ServiceRecord.fromTxt(mapOf("id" to id.toByteArray()), "x")).isNull()
        assertThat(ServiceRecord.fromTxt(emptyMap(), "x")).isNull()
    }

    @Test fun fallsBackToInstanceName() {
        val r = ServiceRecord.fromTxt(mapOf("id" to id.toByteArray(), "v" to "1".toByteArray(), "n" to null), "Living Room")
        assertThat(r!!.name).isEqualTo("Living Room")
    }

    @Test fun instanceNameFitsMdns() {
        assertThat(ServiceRecord.instanceName("My.TV")).isEqualTo("My TV")
        assertThat(ServiceRecord.instanceName("   ")).isEqualTo("TV Hub")
        assertThat(ServiceRecord.instanceName("تلفزيون".repeat(10)).toByteArray().size).isAtMost(63)
    }

    @Test fun prefersLanIpv4() {
        assertThat(ServiceRecord.pickAddress(listOf("fe80::1", "192.168.1.9"))).isEqualTo("192.168.1.9")
        assertThat(ServiceRecord.pickAddress(listOf("fe80::1", "fd00::5"))).isEqualTo("fd00::5")
        assertThat(ServiceRecord.pickAddress(emptyList())).isNull()
    }
}
