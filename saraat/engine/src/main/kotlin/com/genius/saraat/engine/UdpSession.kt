package com.genius.saraat.engine

import java.io.IOException
import java.nio.ByteBuffer
import java.nio.channels.CancelledKeyException
import java.nio.channels.DatagramChannel
import java.nio.channels.SelectionKey

/** One UDP "flow" (app port -> remote address), backed by a connected [DatagramChannel]. */
internal class UdpSession(
    val key: Long,
    val clientPort: Int,
    val remoteIp: Int,
    val remotePort: Int,
    val uid: Int,
    val exempt: Boolean,
    val counted: Boolean,
    private val channel: DatagramChannel,
    private val onDatagram: (UdpSession, ByteArray) -> Unit,
    now: Long,
) {
    var selKey: SelectionKey? = null
    var lastActivity = now

    /** DNS answers come back in milliseconds; everything else may legitimately stay quiet for a while. */
    val idleTimeoutNanos: Long = if (remotePort == 53) 10_000_000_000L else 120_000_000_000L

    private val readBuf = ByteBuffer.allocate(65535)

    fun onSelected(key: SelectionKey, now: Long) {
        try {
            if (!key.isValid || !key.isReadable) return
        } catch (_: CancelledKeyException) {
            return
        }
        repeat(16) {
            readBuf.clear()
            val n = try {
                channel.read(readBuf)
            } catch (_: IOException) {
                return // e.g. ICMP port unreachable surfaced as an error: nothing to deliver
            }
            if (n <= 0) return
            lastActivity = now
            onDatagram(this, readBuf.array().copyOf(n))
        }
    }

    fun sendToRemote(data: ByteArray) {
        try {
            channel.write(ByteBuffer.wrap(data))
        } catch (_: IOException) {
            // dropped, exactly like UDP would
        }
    }

    fun close() {
        try {
            selKey?.cancel()
            channel.close()
        } catch (_: IOException) {
        }
    }
}
