package com.genius.tvhub.engine.stream

import android.content.Context
import android.os.Build
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.VideoPacket
import com.genius.tvhub.engine.stream.capture.ProjectionHolder
import com.genius.tvhub.engine.stream.encode.ScreenEncoder
import com.genius.tvhub.engine.stream.quality.BitrateController
import com.genius.tvhub.engine.stream.quality.StreamPlanner
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow

/**
 * TV side of the live screen. [packets] is cold: collecting it starts an encoder on the
 * projection, cancelling stops it. One viewer at a time; a new one replaces the old.
 */
class StreamEngine(private val context: Context) {
    val projection = ProjectionHolder(context)
    @Volatile private var encoder: ScreenEncoder? = null
    @Volatile var quality: StreamQuality = StreamQuality.BALANCED
        private set
    private var controller: BitrateController? = null

    fun packets(q: StreamQuality): Flow<VideoPacket> = callbackFlow {
        quality = q
        val metrics = displaySize()
        val format = StreamPlanner.plan(metrics.first, metrics.second, q)
        val enc = ScreenEncoder(format)
        encoder = enc
        controller = BitrateController(format.bitrate)
        trySend(VideoPacket.format(format.width, format.height, format.fps, format.bitrate))
        projection.attach(enc.inputSurface, format.width, format.height, context.resources.displayMetrics.densityDpi)
        // If the outgoing buffer is full a frame is dropped; ask for a key frame so the picture heals.
        enc.start { if (trySend(it).isFailure) enc.requestKeyFrame() }
        awaitClose {
            projection.detach()
            enc.stop()
            if (encoder === enc) encoder = null
        }
    }.buffer(OUTGOING_FRAMES)

    fun requestKeyFrame() { encoder?.requestKeyFrame() }

    /** Called by the host as it sends: [queued] = packets waiting in its outgoing buffer. */
    fun reportQueue(queued: Int, nowMillis: Long) {
        controller?.onSample(queued, nowMillis)?.let { encoder?.setBitrate(it) }
    }

    private fun displaySize(): Pair<Int, Int> = if (Build.VERSION.SDK_INT >= 30) {
        context.getSystemService(android.view.WindowManager::class.java).maximumWindowMetrics.bounds.let { it.width() to it.height() }
    } else context.resources.displayMetrics.let { it.widthPixels to it.heightPixels }

    private companion object { const val OUTGOING_FRAMES = 48 }
}
