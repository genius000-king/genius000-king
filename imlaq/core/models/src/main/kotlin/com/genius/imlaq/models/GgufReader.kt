package com.genius.imlaq.models

import java.io.BufferedInputStream
import java.io.EOFException
import java.io.File
import java.io.IOException
import java.io.InputStream

/** A GGUF array is summarised, never loaded: a tokenizer vocab alone is 150k strings. */
data class GgufArray(val elementType: Int, val count: Long)

data class GgufTensorInfo(val name: String, val offset: Long)

/**
 * Everything the app needs from a GGUF header, read without touching the weights.
 *
 * [dataStart] is the absolute file offset where the tensor data begins; each tensor's
 * [GgufTensorInfo.offset] is relative to it.
 */
class GgufHeader(
    val version: Int,
    val metadata: Map<String, Any>,
    val tensors: List<GgufTensorInfo>,
    val dataStart: Long,
    val fileSize: Long,
) {
    fun string(key: String) = metadata[key] as? String
    fun long(key: String) = (metadata[key] as? Number)?.toLong()

    /**
     * Byte size of every tensor, from the gaps between consecutive offsets — no per-type block
     * table needed. Alignment padding is counted with the tensor before it; at 32 bytes per
     * tensor it is noise next to multi-MB weights.
     */
    fun tensorSizes(): Map<String, Long> {
        val sorted = tensors.sortedBy { it.offset }
        val dataEnd = fileSize - dataStart
        return sorted.mapIndexed { i, t ->
            val next = if (i + 1 < sorted.size) sorted[i + 1].offset else dataEnd
            t.name to (next - t.offset).coerceAtLeast(0)
        }.toMap()
    }
}

class GgufFormatException(message: String) : IOException(message)

/** Reads GGUF v2/v3 headers (https://github.com/ggml-org/ggml/blob/master/docs/gguf.md). */
object GgufReader {

    private const val MAGIC = 0x46554747 // "GGUF" little-endian
    private const val MAX_KEY_BYTES = 1 shl 16
    private const val MAX_STRING_BYTES = 64L shl 20
    private const val DEFAULT_ALIGNMENT = 32L

    // Value types from the spec.
    private const val T_UINT8 = 0
    private const val T_INT8 = 1
    private const val T_UINT16 = 2
    private const val T_INT16 = 3
    private const val T_UINT32 = 4
    private const val T_INT32 = 5
    private const val T_FLOAT32 = 6
    private const val T_BOOL = 7
    private const val T_STRING = 8
    private const val T_ARRAY = 9
    private const val T_UINT64 = 10
    private const val T_INT64 = 11
    private const val T_FLOAT64 = 12

    fun read(file: File): GgufHeader = file.inputStream().use { read(it, file.length()) }

    fun read(stream: InputStream, fileSize: Long): GgufHeader {
        val input = LeInput(BufferedInputStream(stream, 1 shl 16))
        if (input.i32() != MAGIC) throw GgufFormatException("not a GGUF file")
        val version = input.i32()
        if (version !in 2..3) throw GgufFormatException("unsupported GGUF version $version")
        val tensorCount = input.i64()
        val kvCount = input.i64()
        if (tensorCount !in 0..1_000_000 || kvCount !in 0..1_000_000) {
            throw GgufFormatException("implausible header counts")
        }

        val metadata = LinkedHashMap<String, Any>()
        repeat(kvCount.toInt()) {
            val key = input.string(MAX_KEY_BYTES.toLong())
            metadata[key] = input.value(input.i32())
        }

        val tensors = ArrayList<GgufTensorInfo>(tensorCount.toInt())
        repeat(tensorCount.toInt()) {
            val name = input.string(MAX_KEY_BYTES.toLong())
            val nDims = input.i32()
            if (nDims !in 0..8) throw GgufFormatException("tensor $name has $nDims dims")
            repeat(nDims) { input.i64() }
            input.i32() // ggml type — sizes come from offsets instead
            tensors += GgufTensorInfo(name, input.i64())
        }

        val alignment = (metadata["general.alignment"] as? Number)?.toLong() ?: DEFAULT_ALIGNMENT
        val pos = input.position
        val dataStart = (pos + alignment - 1) / alignment * alignment
        return GgufHeader(version, metadata, tensors, dataStart, fileSize)
    }

    private fun LeInput.value(type: Int): Any = when (type) {
        T_UINT8 -> u8().toLong()
        T_INT8 -> u8().toByte().toLong()
        T_UINT16 -> u16().toLong()
        T_INT16 -> u16().toShort().toLong()
        T_UINT32 -> i32().toLong() and 0xFFFF_FFFFL
        T_INT32 -> i32().toLong()
        T_FLOAT32 -> Float.fromBits(i32()).toDouble()
        T_BOOL -> u8() != 0
        T_STRING -> string(MAX_STRING_BYTES)
        T_UINT64, T_INT64 -> i64()
        T_FLOAT64 -> Double.fromBits(i64())
        T_ARRAY -> {
            val elementType = i32()
            val count = i64()
            if (count < 0) throw GgufFormatException("negative array length")
            skipArray(elementType, count)
            GgufArray(elementType, count)
        }
        else -> throw GgufFormatException("unknown value type $type")
    }

    private fun LeInput.skipArray(elementType: Int, count: Long) {
        val width = when (elementType) {
            T_UINT8, T_INT8, T_BOOL -> 1L
            T_UINT16, T_INT16 -> 2L
            T_UINT32, T_INT32, T_FLOAT32 -> 4L
            T_UINT64, T_INT64, T_FLOAT64 -> 8L
            else -> 0L
        }
        when {
            width > 0 -> skip(width * count)
            elementType == T_STRING -> repeat(count) { skip(lengthPrefix(MAX_STRING_BYTES)) }
            elementType == T_ARRAY -> repeat(count) { skipArray(i32(), i64()) }
            else -> throw GgufFormatException("unknown array element type $elementType")
        }
    }

    private inline fun repeat(times: Long, action: () -> Unit) {
        var i = 0L
        while (i < times) { action(); i++ }
    }

    /** Little-endian reader that tracks its position (needed to locate the data section). */
    private class LeInput(private val inp: InputStream) {
        var position = 0L
            private set

        fun u8(): Int {
            val b = inp.read()
            if (b < 0) throw EOFException("truncated GGUF header")
            position++
            return b
        }

        fun u16(): Int = u8() or (u8() shl 8)

        fun i32(): Int = u8() or (u8() shl 8) or (u8() shl 16) or (u8() shl 24)

        fun i64(): Long = (i32().toLong() and 0xFFFF_FFFFL) or (i32().toLong() shl 32)

        fun lengthPrefix(max: Long): Long {
            val n = i64()
            if (n !in 0..max) throw GgufFormatException("string length $n out of range")
            return n
        }

        fun string(max: Long): String {
            val n = lengthPrefix(max).toInt()
            val bytes = ByteArray(n)
            var off = 0
            while (off < n) {
                val r = inp.read(bytes, off, n - off)
                if (r < 0) throw EOFException("truncated GGUF string")
                off += r
            }
            position += n
            return String(bytes, Charsets.UTF_8)
        }

        fun skip(n: Long) {
            var left = n
            while (left > 0) {
                val s = inp.skip(left)
                if (s > 0) {
                    left -= s
                } else {
                    // skip() may return 0 before EOF; read() tells the two apart.
                    if (inp.read() < 0) throw EOFException("truncated GGUF header")
                    left--
                }
            }
            position += n
        }
    }
}
