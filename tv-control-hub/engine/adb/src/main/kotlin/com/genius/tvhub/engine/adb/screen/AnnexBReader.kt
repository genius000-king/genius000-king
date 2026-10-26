package com.genius.tvhub.engine.adb.screen

import java.io.ByteArrayOutputStream

/** One unit of an H.264 stream, ready for a decoder: parameter sets, or one whole picture. */
class H264Unit(val config: Boolean, val keyFrame: Boolean, val data: ByteArray)

/**
 * Splits a raw Annex-B H.264 byte stream (what `screenrecord --output-format=h264` writes) into
 * decoder units. Pure: bytes in, units out.
 *
 * - SPS/PPS gather into one config unit.
 * - A picture starts at a slice whose first_mb_in_slice is 0; further slices of the same picture,
 *   and SEI/AUD before it, join it. Multi-slice encoders work the same as single-slice ones.
 * - The stream has no end markers, so the last NAL is only known complete when the next start
 *   code arrives. [flush] closes it when the caller sees the stream go quiet; otherwise a still
 *   screen would leave its last frame waiting.
 *
 * Every unit keeps its start codes, which MediaCodec accepts as-is.
 */
class AnnexBReader {
    private val pending = ByteArrayOutputStream()
    private val picture = ByteArrayOutputStream()
    private var pictureKey = false
    private var pictureHasSlice = false
    private val config = ByteArrayOutputStream()

    fun feed(bytes: ByteArray, length: Int = bytes.size): List<H264Unit> {
        pending.write(bytes, 0, length)
        val buf = pending.toByteArray()
        val out = mutableListOf<H264Unit>()
        val starts = startCodes(buf)
        if (starts.size < 2) return out
        // Every NAL between two start codes is complete; the tail stays pending.
        for (i in 0 until starts.size - 1) onNal(buf, starts[i], starts[i + 1], out)
        pending.reset()
        pending.write(buf, starts.last(), buf.size - starts.last())
        // The next NAL has begun and is not a parameter set: the config is complete, send it now.
        val tailHeader = starts.last() + startCodeLength(buf, starts.last())
        if (tailHeader < buf.size && (buf[tailHeader].toInt() and 0x1F) !in NAL_SPS..NAL_PPS) closeConfig(out)
        return out
    }

    /** The stream went quiet: the pending NAL is complete, and so is the picture it belongs to. */
    fun flush(): List<H264Unit> {
        val out = mutableListOf<H264Unit>()
        val buf = pending.toByteArray()
        pending.reset()
        val starts = startCodes(buf)
        if (starts.isNotEmpty()) {
            for (i in starts.indices) onNal(buf, starts[i], if (i + 1 < starts.size) starts[i + 1] else buf.size, out)
        }
        closeConfig(out)
        closePicture(out)
        return out
    }

    private fun onNal(buf: ByteArray, start: Int, end: Int, out: MutableList<H264Unit>) {
        val header = start + startCodeLength(buf, start)
        if (header >= end) return
        when (val type = buf[header].toInt() and 0x1F) {
            NAL_SPS, NAL_PPS -> {
                closePicture(out)
                config.write(buf, start, end - start)
            }
            NAL_IDR, NAL_SLICE -> {
                closeConfig(out)
                val firstMbZero = header + 1 < end && (buf[header + 1].toInt() and 0x80) != 0
                if (firstMbZero && pictureHasSlice) closePicture(out)
                picture.write(buf, start, end - start)
                pictureHasSlice = true
                if (type == NAL_IDR) pictureKey = true
            }
            else -> {
                // SEI, AUD...: they precede the picture they describe.
                closeConfig(out)
                if (pictureHasSlice) closePicture(out)
                picture.write(buf, start, end - start)
            }
        }
    }

    private fun closeConfig(out: MutableList<H264Unit>) {
        if (config.size() == 0) return
        out += H264Unit(config = true, keyFrame = false, data = config.toByteArray())
        config.reset()
    }

    private fun closePicture(out: MutableList<H264Unit>) {
        if (pictureHasSlice) out += H264Unit(config = false, keyFrame = pictureKey, data = picture.toByteArray())
        if (pictureHasSlice) picture.reset()
        pictureKey = false
        pictureHasSlice = false
    }

    private companion object {
        const val NAL_SLICE = 1
        const val NAL_IDR = 5
        const val NAL_SPS = 7
        const val NAL_PPS = 8

        /** Offsets of each 00 00 01 / 00 00 00 01 start code (pointing at its first zero). */
        fun startCodes(b: ByteArray): List<Int> {
            val out = mutableListOf<Int>()
            var i = 0
            while (i + 2 < b.size) {
                if (b[i].toInt() == 0 && b[i + 1].toInt() == 0) {
                    if (b[i + 2].toInt() == 1) { out += if (i > 0 && b[i - 1].toInt() == 0) i - 1 else i; i += 3; continue }
                }
                i++
            }
            return out
        }

        fun startCodeLength(b: ByteArray, at: Int) = if (b[at + 2].toInt() == 1) 3 else 4
    }
}
