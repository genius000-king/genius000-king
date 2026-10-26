package com.genius.tvhub.engine.adb

import com.genius.tvhub.engine.adb.agent.AgentCommand
import com.genius.tvhub.engine.adb.agent.AgentProtocol
import com.genius.tvhub.engine.adb.screen.AnnexBReader
import com.genius.tvhub.engine.adb.screen.H264Unit
import com.genius.tvhub.engine.adb.setup.SetupPlan
import com.genius.tvhub.engine.adb.setup.StepId
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class AnnexBReaderTest {
    private fun nal(type: Int, firstMbZero: Boolean = true, size: Int = 6, long: Boolean = false): ByteArray {
        val start = if (long) byteArrayOf(0, 0, 0, 1) else byteArrayOf(0, 0, 1)
        val header = byteArrayOf((0x60 or type).toByte(), if (firstMbZero) 0x88.toByte() else 0x10)
        return start + header + ByteArray(size) { (0x40 + it).toByte() }
    }

    private val sps = nal(7, long = true)
    private val pps = nal(8)
    private val idr = nal(5, size = 40)
    private val p1 = nal(1)
    private val p2 = nal(1)

    private fun AnnexBReader.all(vararg chunks: ByteArray) = chunks.flatMap { feed(it) } + flush()

    @Test fun splitsConfigAndPictures() {
        val units = AnnexBReader().all(sps + pps + idr + p1 + p2)
        assertThat(units.map { it.kind() }).containsExactly("config", "key", "frame", "frame").inOrder()
        assertThat(units[0].data).isEqualTo(sps + pps)
        assertThat(units[1].data).isEqualTo(idr)
    }

    @Test fun sameResultWhateverTheChunking() {
        val stream = sps + pps + idr + p1 + p2
        val whole = AnnexBReader().all(stream).map { it.kind() to it.data.toList() }
        // Byte by byte, including chunks that end inside a start code.
        val bytes = stream.map { byteArrayOf(it) }.toTypedArray()
        val split = AnnexBReader().all(*bytes).map { it.kind() to it.data.toList() }
        assertThat(split).isEqualTo(whole)
    }

    @Test fun slicesOfOnePictureStayTogether() {
        val second = nal(5, firstMbZero = false, size = 10)
        val units = AnnexBReader().all(sps + pps + idr + second + p1)
        assertThat(units.map { it.kind() }).containsExactly("config", "key", "frame").inOrder()
        assertThat(units[1].data).isEqualTo(idr + second)
    }

    @Test fun seiTravelsWithTheFollowingPicture() {
        val sei = nal(6)
        val units = AnnexBReader().all(sps + pps + idr + sei + p1)
        assertThat(units[2].data).isEqualTo(sei + p1)
    }

    @Test fun lastFrameWaitsForTheNextStartCodeOrAFlush() {
        val r = AnnexBReader()
        val early = r.feed(sps + pps + idr)
        // The IDR may still be growing: only the config is certain.
        assertThat(early.map { it.kind() }).containsExactly("config")
        assertThat(r.flush().map { it.kind() }).containsExactly("key")
    }

    @Test fun restartedStreamBeginsAgainWithConfig() {
        val units = AnnexBReader().all(sps + pps + idr + p1 + sps + pps + idr)
        assertThat(units.map { it.kind() }).containsExactly("config", "key", "frame", "config", "key").inOrder()
    }

    private fun H264Unit.kind() = when { config -> "config"; keyFrame -> "key"; else -> "frame" }
}

class AgentProtocolTest {
    @Test fun everyCommandSurvivesTheWire() {
        listOf(
            AgentCommand.Key(23, longPress = false),
            AgentCommand.Key(4, longPress = true),
            AgentCommand.Text("مرحبا hello\nworld 1 2"),
            AgentCommand.Tap(0.25f, 0.75f, longPress = true),
            AgentCommand.Swipe(listOf(0.1f to 0.5f, 0.9f to 0.5f), 300),
            AgentCommand.Ping,
        ).forEach { assertThat(AgentProtocol.decode(AgentProtocol.encode(it))).isEqualTo(it) }
    }

    @Test fun garbageAndOutOfRangeAreRefused() {
        assertThat(AgentProtocol.decode("rm -rf /")).isNull()
        assertThat(AgentProtocol.decode("tap 2.0 0.5 0")).isNull()
        assertThat(AgentProtocol.decode("swipe 100 0.1,0.1")).isNull()
        assertThat(AgentProtocol.decode("")).isNull()
    }
}

class SetupPlanTest {
    private val ours = "com.genius.tvhub/com.genius.tvhub.engine.input.service.HubAccessibilityService"

    @Test fun keepsOtherAccessibilityServices() {
        assertThat(SetupPlan.mergeServices("a/b.C:d/e.F", ours)).isEqualTo("a/b.C:d/e.F:$ours")
        assertThat(SetupPlan.mergeServices("null", ours)).isEqualTo(ours)
        assertThat(SetupPlan.mergeServices("", ours)).isEqualTo(ours)
        assertThat(SetupPlan.mergeServices("$ours:x/y.Z", ours)).isEqualTo("$ours:x/y.Z")
    }

    @Test fun homeOnlyWhenAsked() {
        val without = SetupPlan.steps("p", ours, null, homeAlias = null).map { it.id }
        assertThat(without).containsNoneOf(StepId.HOME, StepId.HOME_ALIAS)
        val with = SetupPlan.steps("p", ours, null, homeAlias = "p/p.TvHome")
        assertThat(with.first { it.id == StepId.HOME }.command).isEqualTo("cmd package set-home-activity p/p.TvHome")
    }

    @Test fun accessibilityIsRequiredAndQuoted() {
        val steps = SetupPlan.steps("p", ours, "x/y.Z", null)
        val list = steps.first { it.id == StepId.ACCESSIBILITY_LIST }
        assertThat(list.required).isTrue()
        assertThat(list.command).isEqualTo("settings put secure enabled_accessibility_services 'x/y.Z:$ours'")
        assertThat(SetupPlan.quote("it's")).isEqualTo("'it'\\''s'")
    }
}
