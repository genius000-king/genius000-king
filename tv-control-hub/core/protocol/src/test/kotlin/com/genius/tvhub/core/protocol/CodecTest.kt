package com.genius.tvhub.core.protocol

import com.genius.tvhub.core.model.Availability
import com.genius.tvhub.core.model.CpuReading
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkKind
import com.genius.tvhub.core.model.MemoryReading
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.NetworkReading
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.Reading
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.core.model.ThermalLevel
import com.genius.tvhub.core.model.ThermalReading
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class CodecTest {
    private fun roundTrip(frame: Frame): Frame = ProtocolCodec.decode(ProtocolCodec.encode(frame))

    @Test fun everyCallShapeRoundTrips() {
        val calls = listOf(
            Call.Ping(42), Call.GetStatus, Call.Key(KeyAction.HOME), Call.Tap(NormPoint(0.5f, 0.25f)),
            Call.Swipe(listOf(NormPoint(0f, 0f), NormPoint(1f, 1f)), 300),
            Call.Text("مرحبا hello", TextMode.APPEND), Call.Edit(EditAction.ENTER),
            Call.CursorMove(3.5f, -2f), Call.CursorClick(long = true), Call.WatchMetrics(true),
            Call.ListDir(RemotePath("shared", "Movies")), Call.Delete(listOf(RemotePath("app", "a"), RemotePath("app", "b"))),
            Call.RunCommand(ShellBackend.TERMUX, "node -v"), Call.ControlService("web", ServiceAction.RESTART),
            Call.InstallBegin("Firefox", listOf(10, 20, 30)),
        )
        calls.forEachIndexed { i, call ->
            assertThat(roundTrip(Frame.Request(i.toLong(), call))).isEqualTo(Frame.Request(i.toLong(), call))
        }
    }

    @Test fun binaryPayloadSurvivesIntact() {
        val data = ByteArray(256 * 1024) { (it * 31).toByte() }
        val decoded = roundTrip(Frame.Request(7, Call.UploadChunk("t1", 1024, data))) as Frame.Request
        val chunk = decoded.call as Call.UploadChunk
        assertThat(chunk.data).isEqualTo(data)
        assertThat(chunk.offset).isEqualTo(1024)
    }

    @Test fun binaryIsCompactNotBase64() {
        val data = ByteArray(10_000)
        val size = ProtocolCodec.encode(Frame.Response(1, Reply.Bytes(data))).size
        assertThat(size).isLessThan(10_100)
    }

    @Test fun errorsAndPushesRoundTrip() {
        assertThat(roundTrip(Frame.Response(3, Reply.Error(ErrorCode.DENIED, "no")))).isEqualTo(Frame.Response(3, Reply.Error(ErrorCode.DENIED, "no")))
        val snapshot = MetricsSnapshot(
            timestamp = 1, uptimeMillis = 2,
            memory = MemoryReading(2048, 1024, false, 64),
            storage = emptyList(),
            cpu = CpuReading(Reading.of(listOf(1_800_000L)), Reading.needsAdb("/proc/stat blocked"), 0.02f),
            thermal = ThermalReading(Reading.of(ThermalLevel.NONE), Reading.unsupported("n/a"), Reading.unsupported("n/a")),
            network = NetworkReading(LinkKind.WIFI, listOf("192.168.1.20"), Reading.of(-55), Reading.of(433), 10, 20),
            appMemoryBytes = 50,
        )
        val back = roundTrip(Frame.Event(Push.Metrics(snapshot))) as Frame.Event
        val got = (back.push as Push.Metrics).snapshot
        assertThat(got).isEqualTo(snapshot)
        assertThat(got.cpu.loadFraction.availability).isInstanceOf(Availability.NeedsAdb::class.java)
    }

    @Test fun domainsMatchIntent() {
        assertThat(Call.RunCommand(ShellBackend.SANDBOX, "ls").domain).isEqualTo(Domain.SHELL)
        assertThat(Call.Delete(emptyList()).domain).isEqualTo(Domain.FILES_WRITE)
        assertThat(Call.ListDir(RemotePath("a")).domain).isEqualTo(Domain.FILES_READ)
        assertThat(Call.Ping(0).domain).isEqualTo(Domain.SESSION)
    }

    @Test fun videoPacketRoundTrip() {
        val p = VideoPacket(VideoPacket.Kind.FRAME, VideoPacket.FLAG_KEY, 123_456_789L, byteArrayOf(0, 0, 0, 1, 0x65))
        val back = VideoPacket.decode(p.encode())
        assertThat(back.kind).isEqualTo(VideoPacket.Kind.FRAME)
        assertThat(back.isKeyFrame).isTrue()
        assertThat(back.ptsMicros).isEqualTo(123_456_789L)
        assertThat(back.payload).isEqualTo(p.payload)
        assertThat(VideoPacket.readFormat(VideoPacket.decode(VideoPacket.format(1280, 720, 30, 4_000_000).encode())))
            .asList().containsExactly(1280, 720, 30, 4_000_000).inOrder()
    }

    @Test(expected = IllegalArgumentException::class)
    fun truncatedVideoPacketRejected() {
        val bytes = VideoPacket(VideoPacket.Kind.FRAME, 0, 0, ByteArray(10)).encode()
        VideoPacket.decode(bytes.copyOf(bytes.size - 3))
    }
}
