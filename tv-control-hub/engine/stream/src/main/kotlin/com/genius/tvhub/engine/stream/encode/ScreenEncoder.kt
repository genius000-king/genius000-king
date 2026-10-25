package com.genius.tvhub.engine.stream.encode

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import android.os.Bundle
import android.view.Surface
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.core.model.VideoFormat
import com.genius.tvhub.core.protocol.VideoPacket

/**
 * H.264 hardware encoder fed by a Surface (the virtual display draws straight into it, no copies).
 * Low-latency settings: realtime priority, frame repeat on static screens so the picture still
 * refreshes, and a key frame every two seconds so a late viewer starts quickly.
 */
class ScreenEncoder(val format: VideoFormat) {
    private val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    val inputSurface: Surface
    @Volatile private var running = false
    private var thread: Thread? = null

    init {
        val f = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, format.width, format.height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, format.bitrate)
            setInteger(MediaFormat.KEY_FRAME_RATE, format.fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
            setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 100_000)
            setInteger(MediaFormat.KEY_PRIORITY, 0)
            if (Build.VERSION.SDK_INT >= 30) setInteger(MediaFormat.KEY_LATENCY, 1)
        }
        codec.configure(f, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        inputSurface = codec.createInputSurface()
    }

    fun start(onPacket: (VideoPacket) -> Unit) {
        running = true
        codec.start()
        thread = Thread({
            val info = MediaCodec.BufferInfo()
            while (running) {
                val index = try { codec.dequeueOutputBuffer(info, 100_000) } catch (e: IllegalStateException) { break }
                if (index < 0) continue
                val buffer = codec.getOutputBuffer(index)
                if (buffer != null && info.size > 0) {
                    val bytes = ByteArray(info.size)
                    buffer.position(info.offset); buffer.get(bytes)
                    val packet = when {
                        info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0 -> VideoPacket(VideoPacket.Kind.CONFIG, 0, info.presentationTimeUs, bytes)
                        else -> VideoPacket(VideoPacket.Kind.FRAME, if (info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0) VideoPacket.FLAG_KEY else 0, info.presentationTimeUs, bytes)
                    }
                    runCatching { onPacket(packet) }.onFailure { Log.w(TAG, "packet sink failed", it) }
                }
                codec.releaseOutputBuffer(index, false)
            }
        }, "tvhub-encoder").also { it.start() }
    }

    fun setBitrate(bps: Int) = runCatching { codec.setParameters(Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_VIDEO_BITRATE, bps) }) }

    fun requestKeyFrame() = runCatching { codec.setParameters(Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0) }) }

    fun stop() {
        running = false
        thread?.join(500)
        runCatching { codec.stop() }
        runCatching { codec.release() }
        inputSurface.release()
    }

    private companion object { const val TAG = "ScreenEncoder" }
}
