package com.genius.saraat.engine

import java.nio.ByteBuffer
import java.nio.channels.ReadableByteChannel
import java.nio.channels.WritableByteChannel

/**
 * Fixed-capacity circular byte queue that can talk to NIO channels directly (no intermediate copy).
 * Not thread-safe: owned by the engine thread.
 */
internal class ByteRing(val capacity: Int) {
    private val buf = ByteArray(capacity)
    private var head = 0

    var size = 0
        private set

    val free: Int get() = capacity - size

    /** Appends up to [len] bytes; returns how many fit. */
    fun write(src: ByteArray, off: Int, len: Int): Int {
        val n = minOf(len, free)
        var tail = (head + size) % capacity
        var done = 0
        while (done < n) {
            val chunk = minOf(n - done, capacity - tail)
            System.arraycopy(src, off + done, buf, tail, chunk)
            done += chunk
            tail = (tail + chunk) % capacity
        }
        size += n
        return n
    }

    /** Copies [len] bytes that start [offset] bytes after the head, without consuming them. */
    fun copyTo(offset: Int, dst: ByteArray, dstOff: Int, len: Int) {
        require(offset >= 0 && offset + len <= size) { "peek out of range" }
        var pos = (head + offset) % capacity
        var done = 0
        while (done < len) {
            val chunk = minOf(len - done, capacity - pos)
            System.arraycopy(buf, pos, dst, dstOff + done, chunk)
            done += chunk
            pos = (pos + chunk) % capacity
        }
    }

    fun drop(n: Int) {
        require(n in 0..size) { "drop $n of $size" }
        head = (head + n) % capacity
        size -= n
    }

    /**
     * Reads up to [max] bytes from [ch] into the free space.
     * Returns the number of bytes read (0 = nothing available right now) or -1 at end of stream.
     */
    fun readFrom(ch: ReadableByteChannel, max: Int): Int {
        var total = 0
        var budget = minOf(max, free)
        while (budget > 0) {
            val tail = (head + size) % capacity
            val chunk = minOf(budget, capacity - tail)
            val n = ch.read(ByteBuffer.wrap(buf, tail, chunk))
            if (n < 0) return if (total > 0) total else -1
            if (n == 0) break
            size += n
            total += n
            budget -= n
            if (n < chunk) break
        }
        return total
    }

    /** Writes up to [max] bytes from the head into [ch] and consumes what the channel accepted. */
    fun writeTo(ch: WritableByteChannel, max: Int): Int {
        var total = 0
        var budget = minOf(max, size)
        while (budget > 0) {
            val chunk = minOf(budget, capacity - head)
            val n = ch.write(ByteBuffer.wrap(buf, head, chunk))
            if (n == 0) break
            head = (head + n) % capacity
            size -= n
            total += n
            budget -= n
            if (n < chunk) break
        }
        return total
    }
}
