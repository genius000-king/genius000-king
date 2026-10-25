package com.genius.tvhub.engine.monitor

import com.genius.tvhub.engine.monitor.parse.RateMeter
import com.genius.tvhub.engine.monitor.parse.SysfsParser
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class ParserTest {
    @Test fun frequencies() {
        assertThat(SysfsParser.khz("1800000\n")).isEqualTo(1_800_000)
        assertThat(SysfsParser.khz("garbage")).isNull()
        assertThat(SysfsParser.khz(null)).isNull()
        assertThat(SysfsParser.khz("0")).isNull()
    }

    @Test fun temperaturesInMilliOrWholeDegrees() {
        assertThat(SysfsParser.celsius("48500")).isWithin(0.01f).of(48.5f)
        assertThat(SysfsParser.celsius("52")).isEqualTo(52f)
        assertThat(SysfsParser.celsius("-1")).isNull()
        assertThat(SysfsParser.celsius("900000")).isNull()
    }

    @Test fun cpuLoadFromTwoSamples() {
        val a = SysfsParser.cpuTimes("cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 1 2 3 4")!!
        val b = SysfsParser.cpuTimes("cpu  150 0 150 900 0 0 0 0 0 0")!!
        assertThat(SysfsParser.load(a, b)).isWithin(0.001f).of(0.5f)
        assertThat(SysfsParser.cpuTimes("intr 1 2 3")).isNull()
        assertThat(SysfsParser.load(a, a)).isNull()
    }

    @Test fun rateMeterIgnoresFirstSampleAndCounterResets() {
        val m = RateMeter()
        assertThat(m.rate(1000, 0)).isEqualTo(0)
        assertThat(m.rate(3000, 1000)).isEqualTo(2000)
        assertThat(m.rate(10, 2000)).isEqualTo(0)
    }
}
