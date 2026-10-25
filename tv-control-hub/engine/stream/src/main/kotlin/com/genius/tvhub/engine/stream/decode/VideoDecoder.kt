package com.genius.tvhub.engine.stream.decode

import android.media.MediaCodec
import android.media.MediaFormat
import android.os.Build
import android.view.Surface
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.protocol.VideoPacket
import java.util.concurrent.LinkedBlockingDeque
import java.util.concurrent.TimeUnit

/**
 * Phone side: H.264 packets in, picture on a Surface out. Renders each frame the moment it is
 * decoded (no presentation clock: live beats smooth for a remote screen). [onNeedKeyFrame] asks
 * the TV for a fresh start after the [FrameGate] dropped a backlog.
 */
class VideoDecoder(private val surface: Surface, private val onNeedKeyFrame: () -> Unit) {
    private var codec: MediaCodec? = null
    private val queue = LinkedBlockingDeque<VideoPacket>()
    private val gate = FrameGate()
    @Volatile private var running = true
    private val feeder = Thread(::feedLoop, "tvhub-decoder").apply { start() }
    var onFormat: ((width: Int, height: Int) -> Unit)? = null

    fun offer(packet: VideoPacket) {
        when (gate.offer(packet, queue.size)) {
            FrameGate.Verdict.Decode -> queue.offer(packet)
            FrameGate.Verdict.Drop -> Unit
            FrameGate.Verdict.DropAndRequestKey -> { queue.removeIf { it.kind == VideoPacket.Kind.FRAME }; onNeedKeyFrame() }
        }
    }

    private fun feedLoop() {
        val info = MediaCodec.BufferInfo()
        while (running) {
            val packet = queue.poll(50, TimeUnit.MILLISECONDS)
            if (packet != null) handle(packet)
            drain(info)
        }
    }

    private fun handle(p: VideoPacket) {
        when (p.kind) {
            VideoPacket.Kind.FORMAT -> {
                val (w, h) = VideoPacket.readFormat(p).let { it[0] to it[1] }
                configure(w, h)
                onFormat?.invoke(w, h)
            }
            VideoPacket.Kind.CONFIG -> queueInput(p, MediaCodec.BUFFER_FLAG_CODEC_CONFIG)
            VideoPacket.Kind.FRAME -> queueInput(p, if (p.isKeyFrame) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
            VideoPacket.Kind.END -> release()
        }
    }

    private fun configure(w: Int, h: Int) {
        release()
        codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC).apply {
            val f = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w, h)
            if (Build.VERSION.SDK_INT >= 30) f.setInteger(MediaFormat.KEY_LOW_LATENCY, 1)
            configure(f, surface, null, 0)
            start()
        }
    }

    private fun queueInput(p: VideoPacket, flags: Int) {
        val c = codec ?: return
        try {
            val index = c.dequeueInputBuffer(20_000)
            if (index < 0) return
            c.getInputBuffer(index)?.apply { clear(); put(p.payload) }
            c.queueInputBuffer(index, 0, p.payload.size, p.ptsMicros, flags)
        } catch (e: IllegalStateException) {
            Log.w(TAG, "decoder rejected input", e)
        }
    }

    private fun drain(info: MediaCodec.BufferInfo) {
        val c = codec ?: return
        try {
            while (true) {
                val index = c.dequeueOutputBuffer(info, 0)
                if (index < 0) break
                c.releaseOutputBuffer(index, true)
            }
        } catch (_: IllegalStateException) { }
    }

    private fun release() {
        codec?.let { runCatching { it.stop() }; runCatching { it.release() } }
        codec = null
    }

    fun close() {
        running = false
        feeder.join(300)
        release()
    }

    private companion object { const val TAG = "VideoDecoder" }
}
