package io.nawah.linux.core.probe

import com.google.common.truth.Truth.assertThat
import io.nawah.linux.core.model.Compatibility
import org.junit.Test

/**
 * Getting BLOCKED wrong in the permissive direction costs a user twenty
 * minutes and a full disk, so the thresholds are pinned here rather than left
 * to whoever edits them next.
 */
class CompatRulesTest {

    private val GB = 1024L * 1024 * 1024

    private fun facts(
        abi: String = "arm64-v8a",
        ram: Long = 6 * GB,
        free: Long = 20 * GB,
        cores: Int = 8,
        api: Int = 34,
    ) = DeviceFacts(abi, ram, free, cores, api)

    private fun verdict(f: DeviceFacts, required: Long = 3 * GB, proot: Boolean? = null) =
        CompatRules.evaluate(f, required, proot).overall

    @Test
    fun `a healthy arm64 device is good`() {
        assertThat(verdict(facts())).isEqualTo(Compatibility.GOOD)
    }

    @Test
    fun `32-bit arm is blocked because no image is built for it`() {
        assertThat(verdict(facts(abi = "armeabi-v7a"))).isEqualTo(Compatibility.BLOCKED)
    }

    @Test
    fun `an unknown abi is blocked rather than attempted`() {
        assertThat(verdict(facts(abi = "mips"))).isEqualTo(Compatibility.BLOCKED)
    }

    @Test
    fun `under two gigabytes of memory is blocked, under three is tight`() {
        assertThat(verdict(facts(ram = 1536L * 1024 * 1024))).isEqualTo(Compatibility.BLOCKED)
        assertThat(verdict(facts(ram = 2 * GB + 1))).isEqualTo(Compatibility.TIGHT)
        assertThat(verdict(facts(ram = 4 * GB))).isEqualTo(Compatibility.GOOD)
    }

    @Test
    fun `less free space than the install needs is blocked`() {
        assertThat(verdict(facts(free = 2 * GB), required = 3 * GB))
            .isEqualTo(Compatibility.BLOCKED)
    }

    @Test
    fun `just enough space is tight, because apt needs room to work`() {
        assertThat(verdict(facts(free = 3 * GB + 1), required = 3 * GB))
            .isEqualTo(Compatibility.TIGHT)
        assertThat(verdict(facts(free = 10 * GB), required = 3 * GB))
            .isEqualTo(Compatibility.GOOD)
    }

    @Test
    fun `android older than 7 is blocked`() {
        assertThat(verdict(facts(api = 23))).isEqualTo(Compatibility.BLOCKED)
    }

    @Test
    fun `few cores is a warning, not a refusal`() {
        assertThat(verdict(facts(cores = 2))).isEqualTo(Compatibility.TIGHT)
    }

    @Test
    fun `a failed live probe overrides every healthy static signal`() {
        // An OEM kernel with ptrace disabled makes the rest of the report moot.
        assertThat(verdict(facts(), proot = false)).isEqualTo(Compatibility.BLOCKED)
        assertThat(verdict(facts(), proot = true)).isEqualTo(Compatibility.GOOD)
    }

    @Test
    fun `the overall verdict is the worst signal`() {
        val report = CompatRules.evaluate(facts(ram = 2 * GB + 1, cores = 2), 3 * GB, null)
        assertThat(report.overall).isEqualTo(Compatibility.TIGHT)
        assertThat(report.signals).hasSize(5)
    }

    @Test
    fun `every degraded signal carries a reason a human can read`() {
        val report = CompatRules.evaluate(facts(ram = 2 * GB + 1), 3 * GB, null)
        val ram = report.signals.single { it.label == "Memory" }
        assertThat(ram.verdict).isEqualTo(Compatibility.TIGHT)
        assertThat(ram.detail).contains("—")
    }

    @Test
    fun `prootWorks is reported as measured, not inferred`() {
        assertThat(CompatRules.evaluate(facts(), 3 * GB, null).prootWorks).isNull()
        assertThat(CompatRules.evaluate(facts(), 3 * GB, true).prootWorks).isTrue()
    }
}
