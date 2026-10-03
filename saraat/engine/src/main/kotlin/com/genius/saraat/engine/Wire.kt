package com.genius.saraat.engine

import java.net.InetAddress

/*
 * Wire format helpers: parsing and building raw IPv4 / TCP / UDP / ICMP packets.
 *
 * Everything here is allocation-light and works on plain ByteArrays. IPv4 addresses are
 * carried around as a packed Int (big-endian), TCP sequence numbers as Int as well: Kotlin's
 * Int arithmetic wraps exactly like 32-bit sequence space does, so `a - b` is a correct
 * (signed) distance between two sequence numbers.
 */

internal const val PROTO_ICMP = 1
internal const val PROTO_TCP = 6
internal const val PROTO_UDP = 17

internal const val FLAG_FIN = 0x01
internal const val FLAG_SYN = 0x02
internal const val FLAG_RST = 0x04
internal const val FLAG_PSH = 0x08
internal const val FLAG_ACK = 0x10

internal fun ByteArray.u8(i: Int): Int = this[i].toInt() and 0xFF
internal fun ByteArray.u16(i: Int): Int = (u8(i) shl 8) or u8(i + 1)
internal fun ByteArray.i32(i: Int): Int = (u8(i) shl 24) or (u8(i + 1) shl 16) or (u8(i + 2) shl 8) or u8(i + 3)

internal fun ByteArray.put16(i: Int, v: Int) {
    this[i] = (v ushr 8).toByte()
    this[i + 1] = v.toByte()
}

internal fun ByteArray.put32(i: Int, v: Int) {
    this[i] = (v ushr 24).toByte()
    this[i + 1] = (v ushr 16).toByte()
    this[i + 2] = (v ushr 8).toByte()
    this[i + 3] = v.toByte()
}

/** "10.1.10.1" -> packed Int. */
fun parseIpv4(text: String): Int {
    val parts = text.split('.')
    require(parts.size == 4) { "bad IPv4: $text" }
    return parts.fold(0) { acc, p -> (acc shl 8) or p.toInt().also { require(it in 0..255) } }
}

fun formatIpv4(ip: Int): String =
    "${ip ushr 24}.${(ip ushr 16) and 0xFF}.${(ip ushr 8) and 0xFF}.${ip and 0xFF}"

internal fun ipToInet(ip: Int): InetAddress = InetAddress.getByAddress(
    byteArrayOf((ip ushr 24).toByte(), (ip ushr 16).toByte(), (ip ushr 8).toByte(), ip.toByte())
)

/** RFC 1071 internet checksum over [len] bytes, folded with an optional [seed] (pseudo header). */
internal fun checksum(buf: ByteArray, off: Int, len: Int, seed: Long = 0): Int {
    var sum = seed
    var i = off
    val end = off + len
    while (i + 1 < end) {
        sum += ((buf[i].toInt() and 0xFF) shl 8) or (buf[i + 1].toInt() and 0xFF)
        i += 2
    }
    if (i < end) sum += (buf[i].toInt() and 0xFF) shl 8
    while (sum ushr 16 != 0L) sum = (sum and 0xFFFF) + (sum ushr 16)
    return sum.inv().toInt() and 0xFFFF
}

private fun pseudoHeaderSum(src: Int, dst: Int, proto: Int, length: Int): Long =
    ((src ushr 16) + (src and 0xFFFF) + (dst ushr 16) + (dst and 0xFFFF) + proto + length).toLong()

/** Destinations that never leave the local network: not throttled, not counted as internet usage. */
internal fun isLocalNetwork(ip: Int): Boolean {
    val a = ip ushr 24
    val b = (ip ushr 16) and 0xFF
    return a == 10 || a == 127 || (a == 172 && b in 16..31) || (a == 192 && b == 168) || (a == 169 && b == 254)
}

/** Multicast (224/4), broadcast and "this network" - nothing we can proxy through a unicast socket. */
internal fun isMulticastOrBroadcast(ip: Int): Boolean = (ip ushr 28) == 0xE || ip == -1 || (ip ushr 24) == 0

internal class Ipv4(val buf: ByteArray, val length: Int) {
    val ihl: Int = (buf.u8(0) and 0x0F) * 4
    val totalLength: Int = buf.u16(2)
    val protocol: Int = buf.u8(9)
    val src: Int = buf.i32(12)
    val dst: Int = buf.i32(16)

    /** True for any fragment (MF set or non-zero offset). We cannot reassemble, so these are dropped. */
    val isFragment: Boolean get() = (buf.u16(6) and 0x3FFF) != 0

    companion object {
        fun parse(buf: ByteArray, len: Int): Ipv4? {
            if (len < 20 || (buf.u8(0) ushr 4) != 4) return null
            val ihl = (buf.u8(0) and 0x0F) * 4
            if (ihl < 20 || len < ihl) return null
            val total = buf.u16(2)
            if (total < ihl || total > len) return null
            return Ipv4(buf, len)
        }
    }
}

internal class Tcp private constructor(val ip: Ipv4, val mssOption: Int) {
    private val b = ip.buf
    private val o = ip.ihl

    val srcPort: Int = b.u16(o)
    val dstPort: Int = b.u16(o + 2)
    val seq: Int = b.i32(o + 4)
    val ack: Int = b.i32(o + 8)
    private val dataOffset: Int = (b.u8(o + 12) ushr 4) * 4
    val flags: Int = b.u8(o + 13)
    val window: Int = b.u16(o + 14)
    val payloadOffset: Int = o + dataOffset
    val payloadLength: Int = ip.totalLength - ip.ihl - dataOffset

    val isSyn get() = flags and FLAG_SYN != 0
    val isAck get() = flags and FLAG_ACK != 0
    val isFin get() = flags and FLAG_FIN != 0
    val isRst get() = flags and FLAG_RST != 0

    companion object {
        fun parse(ip: Ipv4): Tcp? {
            val b = ip.buf
            val o = ip.ihl
            if (ip.totalLength - ip.ihl < 20) return null
            val dataOffset = (b.u8(o + 12) ushr 4) * 4
            if (dataOffset < 20 || ip.ihl + dataOffset > ip.totalLength) return null
            return Tcp(ip, parseMss(b, o + 20, o + dataOffset))
        }

        private fun parseMss(b: ByteArray, start: Int, end: Int): Int {
            var i = start
            while (i < end) {
                when (val kind = b.u8(i)) {
                    0 -> return 0
                    1 -> i++
                    else -> {
                        if (i + 1 >= end) return 0
                        val len = b.u8(i + 1)
                        if (len < 2) return 0
                        if (kind == 2 && len == 4 && i + 3 < end) return b.u16(i + 2)
                        i += len
                    }
                }
            }
            return 0
        }
    }
}

internal class Udp private constructor(val ip: Ipv4) {
    private val b = ip.buf
    private val o = ip.ihl
    val srcPort: Int = b.u16(o)
    val dstPort: Int = b.u16(o + 2)
    val payloadOffset: Int = o + 8
    val payloadLength: Int = minOf(b.u16(o + 4) - 8, ip.totalLength - ip.ihl - 8)

    companion object {
        fun parse(ip: Ipv4): Udp? {
            if (ip.totalLength - ip.ihl < 8) return null
            val u = Udp(ip)
            return if (u.payloadLength < 0) null else u
        }
    }
}

/** Builds packets in one reusable buffer and pushes them straight into the TUN. Engine-thread only. */
internal class PacketWriter(private val tun: TunPort) {
    private val out = ByteArray(65535)
    private var ipId = 1

    private fun ipHeader(total: Int, proto: Int, src: Int, dst: Int) {
        out[0] = 0x45
        out[1] = 0
        out.put16(2, total)
        out.put16(4, ipId++ and 0xFFFF)
        out.put16(6, 0x4000) // DF
        out[8] = 64
        out[9] = proto.toByte()
        out.put16(10, 0)
        out.put32(12, src)
        out.put32(16, dst)
        out.put16(10, checksum(out, 0, 20))
    }

    /** [mss] > 0 adds the MSS option (SYN-ACK only). */
    fun tcp(
        src: Int, srcPort: Int, dst: Int, dstPort: Int,
        seq: Int, ack: Int, flags: Int, window: Int,
        payload: ByteArray? = null, payloadOff: Int = 0, payloadLen: Int = 0, mss: Int = 0,
    ) {
        val optLen = if (mss > 0) 4 else 0
        val tcpLen = 20 + optLen + payloadLen
        val total = 20 + tcpLen
        ipHeader(total, PROTO_TCP, src, dst)
        out.put16(20, srcPort)
        out.put16(22, dstPort)
        out.put32(24, seq)
        out.put32(28, ack)
        out[32] = ((5 + optLen / 4) shl 4).toByte()
        out[33] = flags.toByte()
        out.put16(34, window)
        out.put16(36, 0)
        out.put16(38, 0)
        if (optLen > 0) {
            out[40] = 2
            out[41] = 4
            out.put16(42, mss)
        }
        if (payloadLen > 0) System.arraycopy(payload!!, payloadOff, out, 20 + 20 + optLen, payloadLen)
        out.put16(36, checksum(out, 20, tcpLen, pseudoHeaderSum(src, dst, PROTO_TCP, tcpLen)))
        tun.write(out, 0, total)
    }

    fun udp(src: Int, srcPort: Int, dst: Int, dstPort: Int, payload: ByteArray, off: Int, len: Int) {
        val udpLen = 8 + len
        val total = 20 + udpLen
        ipHeader(total, PROTO_UDP, src, dst)
        out.put16(20, srcPort)
        out.put16(22, dstPort)
        out.put16(24, udpLen)
        out.put16(26, 0)
        System.arraycopy(payload, off, out, 28, len)
        var c = checksum(out, 20, udpLen, pseudoHeaderSum(src, dst, PROTO_UDP, udpLen))
        if (c == 0) c = 0xFFFF
        out.put16(26, c)
        tun.write(out, 0, total)
    }

    /** ICMP "port unreachable" for [orig] (a UDP packet we refuse to carry), so the sender fails fast. */
    fun icmpPortUnreachable(orig: Ipv4) {
        val quoted = minOf(orig.ihl + 8, orig.length)
        val icmpLen = 8 + quoted
        val total = 20 + icmpLen
        ipHeader(total, PROTO_ICMP, orig.dst, orig.src)
        out[20] = 3 // destination unreachable
        out[21] = 3 // port unreachable
        out.put16(22, 0)
        out.put32(24, 0)
        System.arraycopy(orig.buf, 0, out, 28, quoted)
        out.put16(22, checksum(out, 20, icmpLen))
        tun.write(out, 0, total)
    }
}
