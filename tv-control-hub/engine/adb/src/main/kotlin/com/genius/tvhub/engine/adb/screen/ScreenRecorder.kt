package com.genius.tvhub.engine.adb.screen

import com.genius.tvhub.core.common.Log
import dadb.Dadb
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.concurrent.thread

/**
 * The TV's screen through `screenrecord` as the shell user: no capture prompt, and it works on
 * TV builds that removed Android's screen-capture dialog. screenrecord stops after its time limit
 * (3 minutes on most versions), so it is restarted; each run begins with fresh parameter sets and
 * a key frame, which the decoder takes in stride.
 */
internal class ScreenRecorder(private val dadb: () -> Dadb?) {
    @Volatile private var running: AutoCloseable? = null
    @Volatile private var lastRefresh = 0L

    /**
     * screenrecord can't be asked for a key frame, and its encoder sends one only every few
     * seconds. Restarting it gives one at once (a fresh run opens with a key frame).
     */
    fun refresh() {
        val now = System.currentTimeMillis()
        if (now - lastRefresh < REFRESH_GAP_MILLIS) return
        lastRefresh = now
        runCatching { running?.close() }
    }

    fun units(width: Int, height: Int, bitrate: Int): Flow<H264Unit> = callbackFlow {
        val chunks = Channel<ByteArray>(capacity = 64)
        launch {
            val reader = AnnexBReader()
            while (isActive) {
                // Quiet for a moment = the last frame is complete (screenrecord writes a frame at once).
                val chunk = withTimeoutOrNull(QUIET_MILLIS) { chunks.receiveCatching() }
                val units = when {
                    chunk == null -> reader.flush()
                    chunk.isClosed -> { reader.flush().forEach { send(it) }; break }
                    else -> reader.feed(chunk.getOrThrow())
                }
                units.forEach { send(it) }
            }
            close()
        }
        // Closed from outside on cancel: a blocking read would otherwise wait for the next frame.
        var current: AutoCloseable? = null
        val worker = thread(name = "screenrecord", isDaemon = true) {
            var failures = 0
            while (!Thread.currentThread().isInterrupted && failures < MAX_QUICK_FAILURES) {
                val d = dadb() ?: break
                val startedAt = System.currentTimeMillis()
                var got = 0L
                val result = runCatching {
                    d.open("exec:screenrecord --output-format=h264 --size ${width}x$height --bit-rate $bitrate --time-limit 180 -").also { current = it; running = it }.use { s ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = s.source.read(buf)
                            if (n < 0) break
                            got += n
                            if (chunks.trySendBlocking(buf.copyOf(n)).isFailure) return@use
                        }
                    }
                }
                result.exceptionOrNull()?.let { Log.w(TAG, "screenrecord stopped", it) }
                // A run that died at once with nothing to show is a failure; a normal 3-minute end is not.
                failures = if (got == 0L && System.currentTimeMillis() - startedAt < 3_000) failures + 1 else 0
                if (chunks.isClosedForSend) break
            }
            if (failures >= MAX_QUICK_FAILURES) Log.w(TAG, "screenrecord keeps failing; giving up")
            chunks.close()
        }
        awaitClose {
            chunks.close()
            worker.interrupt()
            runCatching { current?.close() }
        }
    }.buffer(OUTGOING).flowOn(Dispatchers.IO)

    private companion object {
        const val TAG = "ScreenRecorder"
        const val QUIET_MILLIS = 12L
        const val MAX_QUICK_FAILURES = 3
        const val OUTGOING = 48
        const val REFRESH_GAP_MILLIS = 2_000L
    }
}
