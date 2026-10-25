package com.genius.tvhub.engine.stream.decode

import com.genius.tvhub.core.protocol.VideoPacket

/**
 * Keeps the phone's picture live rather than complete: if the decoder falls more than [maxLag]
 * frames behind, everything up to the next key frame is dropped (and one is requested), so the
 * screen jumps to now instead of replaying the past slowly. Pure.
 */
class FrameGate(private val maxLag: Int = 6) {
    private var waitingForKey = true

    sealed interface Verdict {
        data object Decode : Verdict
        data object Drop : Verdict
        /** Drop, and ask the TV for a key frame. */
        data object DropAndRequestKey : Verdict
    }

    fun offer(packet: VideoPacket, backlog: Int): Verdict {
        if (packet.kind != VideoPacket.Kind.FRAME) {
            if (packet.kind == VideoPacket.Kind.FORMAT) waitingForKey = true
            return Verdict.Decode
        }
        if (packet.isKeyFrame) { waitingForKey = false; return Verdict.Decode }
        if (waitingForKey) return Verdict.Drop
        if (backlog > maxLag) { waitingForKey = true; return Verdict.DropAndRequestKey }
        return Verdict.Decode
    }
}
