package com.genius.tvhub.engine.stream

import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.engine.stream.decode.FrameGate
import com.genius.tvhub.engine.stream.quality.BitrateController
import com.genius.tvhub.engine.stream.quality.StreamPlanner
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class StreamPlannerTest {
    @Test fun scalesDownKeepsAspectAndAligns() {
        val f = StreamPlanner.plan(1920, 1080, StreamQuality.BALANCED)
        assertThat(f.height).isEqualTo(720)
        assertThat(f.width).isEqualTo(1280)
        assertThat(f.width % 16).isEqualTo(0)
    }

    @Test fun neverUpscales() {
        val f = StreamPlanner.plan(1280, 720, StreamQuality.HIGH)
        assertThat(f.height).isEqualTo(720)
        assertThat(f.bitrate).isLessThan(StreamQuality.HIGH.bitrate)
    }

    @Test fun fourKTvStreamsAt1080() {
        val f = StreamPlanner.plan(3840, 2160, StreamQuality.HIGH)
        assertThat(f.width to f.height).isEqualTo(1920 to 1088)
        assertThat(f.fps).isEqualTo(60)
    }
}

class BitrateControllerTest {
    @Test fun cutsFastRecoversSlowly() {
        val c = BitrateController(4_000_000)
        assertThat(c.onSample(10, 0)).isEqualTo(3_000_000)
        assertThat(c.onSample(10, 100)).isEqualTo(2_250_000)
        assertThat(c.onSample(0, 200)).isNull()
        assertThat(c.onSample(0, 4_000)).isNull()
        assertThat(c.onSample(0, 5_300)).isEqualTo(2_475_000)
    }

    @Test fun neverBelowFloorOrAboveTarget() {
        val c = BitrateController(1_000_000, floor = 600_000)
        repeat(10) { c.onSample(20, it.toLong()) }
        assertThat(c.current).isEqualTo(600_000)
        var t = 10L
        repeat(30) { t += 5_100; c.onSample(0, t) }
        assertThat(c.current).isEqualTo(1_000_000)
    }
}

class FrameGateTest {
    private fun frame(key: Boolean) = VideoPacket(VideoPacket.Kind.FRAME, if (key) VideoPacket.FLAG_KEY else 0, 0, ByteArray(1))

    @Test fun waitsForFirstKeyFrame() {
        val g = FrameGate()
        assertThat(g.offer(frame(false), 0)).isEqualTo(FrameGate.Verdict.Drop)
        assertThat(g.offer(frame(true), 0)).isEqualTo(FrameGate.Verdict.Decode)
        assertThat(g.offer(frame(false), 0)).isEqualTo(FrameGate.Verdict.Decode)
    }

    @Test fun backlogJumpsToNow() {
        val g = FrameGate(maxLag = 3)
        g.offer(frame(true), 0)
        assertThat(g.offer(frame(false), 5)).isEqualTo(FrameGate.Verdict.DropAndRequestKey)
        assertThat(g.offer(frame(false), 0)).isEqualTo(FrameGate.Verdict.Drop)
        assertThat(g.offer(frame(true), 0)).isEqualTo(FrameGate.Verdict.Decode)
    }

    @Test fun configAndFormatAlwaysPass() {
        val g = FrameGate()
        assertThat(g.offer(VideoPacket.format(1, 1, 1, 1), 99)).isEqualTo(FrameGate.Verdict.Decode)
        assertThat(g.offer(VideoPacket(VideoPacket.Kind.CONFIG, 0, 0, ByteArray(2)), 99)).isEqualTo(FrameGate.Verdict.Decode)
    }
}
