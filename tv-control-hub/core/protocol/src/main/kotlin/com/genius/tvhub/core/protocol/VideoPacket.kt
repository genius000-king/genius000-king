package com.genius.tvhub.core.protocol

import java.nio.ByteBuffer

/**
 * One unit on the video channel. Not CBOR: this runs 30–60 times a second, so a fixed 14-byte
 * header and the encoder's bytes as-is.
 *
 * Layout: kind:u8 | flags:u8 | ptsMicros:i64 | length:i32 | payload
 * A FORMAT packet's payload is width:i32 height:i32 fps:i32 bitrate:i32.
 */
class VideoPacket(val kind: Kind, val flags: Int, val ptsMicros: Long, val payload: ByteArray) {
    enum class Kind { FORMAT, CONFIG, FRAME, END }

    val isKeyFrame get() = flags and FLAG_KEY != 0

    fun encode(): ByteArray = ByteBuffer.allocate(HEADER + payload.size)
        .put(kind.ordinal.toByte())
        .put(flags.toByte())
        .putLong(ptsMicros)
        .putInt(payload.size)
        .put(payload)
        .array()

    companion object {
        const val HEADER = 14
        const val FLAG_KEY = 1

        fun decode(bytes: ByteArray): VideoPacket {
            require(bytes.size >= HEADER) { "video packet too short: ${bytes.size}" }
            val buf = ByteBuffer.wrap(bytes)
            val kindIndex = buf.get().toInt()
            require(kindIndex in Kind.entries.indices) { "unknown video packet kind $kindIndex" }
            val flags = buf.get().toInt() and 0xFF
            val pts = buf.long
            val length = buf.int
            require(length == bytes.size - HEADER) { "video packet length $length does not match ${bytes.size - HEADER}" }
            val payload = ByteArray(length).also { buf.get(it) }
            return VideoPacket(Kind.entries[kindIndex], flags, pts, payload)
        }

        fun format(width: Int, height: Int, fps: Int, bitrate: Int) = VideoPacket(
            Kind.FORMAT, 0, 0,
            ByteBuffer.allocate(16).putInt(width).putInt(height).putInt(fps).putInt(bitrate).array(),
        )

        /** The stream will not start or has stopped, and why: the phone says it instead of guessing. */
        fun end(reason: EndReason) = VideoPacket(Kind.END, 0, 0, byteArrayOf(reason.ordinal.toByte()))

        fun readEnd(packet: VideoPacket): EndReason =
            packet.payload.firstOrNull()?.toInt()?.let { EndReason.entries.getOrNull(it) } ?: EndReason.ENDED

        fun readFormat(packet: VideoPacket): IntArray {
            require(packet.kind == Kind.FORMAT)
            val b = ByteBuffer.wrap(packet.payload)
            return intArrayOf(b.int, b.int, b.int, b.int)
        }
    }
}

enum class EndReason {
    ENDED,
    /** This phone lacks the screen permission on the TV. */
    NOT_ALLOWED,
    /** The TV gave no capture: prompt declined, missing on this build, and no ADB mode. */
    CAPTURE_UNAVAILABLE,
    /** Capture started but the encoder or screenrecord failed. */
    CAPTURE_FAILED,
}
