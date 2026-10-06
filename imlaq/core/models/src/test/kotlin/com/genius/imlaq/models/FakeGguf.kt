package com.genius.imlaq.models

import java.io.ByteArrayOutputStream
import java.io.File

/** Writes minimal but spec-valid GGUF v3 files for tests. */
class FakeGguf {
    private val kvs = ByteArrayOutputStream()
    private var kvCount = 0L
    private val tensors = mutableListOf<Pair<String, Int>>()

    fun string(key: String, value: String) = apply {
        kvs.str(key); kvs.u32(8); kvs.str(value); kvCount++
    }

    fun u32(key: String, value: Int) = apply {
        kvs.str(key); kvs.u32(4); kvs.u32(value); kvCount++
    }

    /** An array of strings, like a tokenizer vocab — must be skipped, not stored. */
    fun stringArray(key: String, values: List<String>) = apply {
        kvs.str(key); kvs.u32(9); kvs.u32(8); kvs.u64(values.size.toLong())
        values.forEach { kvs.str(it) }
        kvCount++
    }

    /** A 1-D f32-typed tensor of [bytes] bytes (the reader takes sizes from offsets). */
    fun tensor(name: String, bytes: Int) = apply { tensors += name to bytes }

    fun writeTo(file: File): File {
        val out = ByteArrayOutputStream()
        out.u32(0x46554747); out.u32(3)
        out.u64(tensors.size.toLong()); out.u64(kvCount)
        kvs.writeTo(out)
        var offset = 0L
        for ((name, bytes) in tensors) {
            out.str(name); out.u32(1); out.u64(bytes / 4L); out.u32(0); out.u64(offset)
            offset += align(bytes.toLong())
        }
        while (out.size() % 32 != 0) out.write(0)
        for ((_, bytes) in tensors) repeat(align(bytes.toLong()).toInt()) { out.write(7) }
        file.writeBytes(out.toByteArray())
        return file
    }

    private fun align(n: Long) = (n + 31) / 32 * 32

    private fun ByteArrayOutputStream.u32(v: Int) {
        for (i in 0 until 4) write((v ushr (8 * i)) and 0xFF)
    }

    private fun ByteArrayOutputStream.u64(v: Long) {
        for (i in 0 until 8) write(((v ushr (8 * i)) and 0xFF).toInt())
    }

    private fun ByteArrayOutputStream.str(s: String) {
        val b = s.toByteArray(Charsets.UTF_8)
        u64(b.size.toLong()); write(b)
    }
}
