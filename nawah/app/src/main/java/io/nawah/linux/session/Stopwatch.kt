package io.nawah.linux.session

import android.os.SystemClock

/**
 * Timestamps the stages of a launch, into the session log.
 *
 * It exists because "starting takes a very long time" arrived with no way to
 * tell which part was slow, and this project has already spent three rounds
 * confidently fixing the wrong thing. Each line carries both the time that
 * stage took and the total so far, so one log answers the question outright:
 *
 * ```
 * nawah: wrote the startup files — 0.04s (0.04s total)
 * nawah: checked the system's packages — 0.31s (0.35s total)
 * nawah: the display server is answering — 2.80s (3.15s total)
 * nawah: the container answered — 1.90s (5.05s total)
 * ```
 *
 * Elapsed-realtime rather than wall-clock: a launch that straddles a clock
 * adjustment must not report a negative duration.
 */
internal class Stopwatch(private val emit: (String) -> Unit) {

    private val started = SystemClock.elapsedRealtime()
    private var last = started

    fun mark(stage: String) {
        val now = SystemClock.elapsedRealtime()
        val step = (now - last) / 1000.0
        val total = (now - started) / 1000.0
        last = now
        emit("nawah: %s — %.2fs (%.2fs total)".format(stage, step, total))
    }
}
