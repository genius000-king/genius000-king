package com.genius.saraat.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.LinkedBlockingQueue

/** A TunPort that just records what the engine writes. */
internal class CapturePort : TunPort {
    val packets = LinkedBlockingQueue<ByteArray>()
    override fun read(buf: ByteArray) = -1
    override fun write(buf: ByteArray, off: Int, len: Int) {
        packets.add(buf.copyOfRange(off, off + len))
    }
    override fun close() = Unit
}

class WireTest {
    private val a = parseIpv4("10.1.10.1")
    private val b = parseIpv4("203.0.113.9")

    /** A correct packet checksums to zero when the checksum field is included in the sum. */
    private fun pseudoVerify(pkt: ByteArray, proto: Int): Int {
        val ihl = (pkt[0].toInt() and 0x0F) * 4
        val len = pkt.size - ihl
        val src = pkt.i32(12)
        val dst = pkt.i32(16)
        val seed = ((src ushr 16) + (src and 0xFFFF) + (dst ushr 16) + (dst and 0xFFFF) + proto + len).toLong()
        return checksum(pkt, ihl, len, seed)
    }

    @Test
    fun tcpPacketsRoundTripWithValidChecksums() {
        val port = CapturePort()
        val payload = ByteArray(1001) { it.toByte() } // odd length exercises checksum padding
        PacketWriter(port).tcp(b, 8080, a, 40000, seq = -5, ack = 123456, flags = FLAG_ACK or FLAG_PSH, window = 32768, payload = payload, payloadLen = payload.size)
        val pkt = port.packets.take()

        assertEquals("IP header checksum", 0, checksum(pkt, 0, 20))
        assertEquals("TCP checksum", 0, pseudoVerify(pkt, PROTO_TCP))

        val ip = Ipv4.parse(pkt, pkt.size)
        assertNotNull(ip)
        val tcp = Tcp.parse(ip!!)!!
        assertEquals(8080, tcp.srcPort)
        assertEquals(40000, tcp.dstPort)
        assertEquals(-5, tcp.seq) // sequence numbers wrap like unsigned 32-bit values
        assertEquals(123456, tcp.ack)
        assertEquals(1001, tcp.payloadLength)
        assertTrue(tcp.isAck)
        assertFalse(tcp.isSyn)
    }

    @Test
    fun synAckCarriesMssOption() {
        val port = CapturePort()
        PacketWriter(port).tcp(b, 80, a, 1234, 1, 2, FLAG_SYN or FLAG_ACK, 65535, mss = 1460)
        val pkt = port.packets.take()
        assertEquals(0, pseudoVerify(pkt, PROTO_TCP))
        val tcp = Tcp.parse(Ipv4.parse(pkt, pkt.size)!!)!!
        assertEquals(1460, tcp.mssOption)
        assertTrue(tcp.isSyn && tcp.isAck)
    }

    @Test
    fun udpPacketsHaveValidChecksums() {
        val port = CapturePort()
        val data = "hello".toByteArray()
        PacketWriter(port).udp(b, 53, a, 5555, data, 0, data.size)
        val pkt = port.packets.take()
        assertEquals(0, checksum(pkt, 0, 20))
        assertEquals(0, pseudoVerify(pkt, PROTO_UDP))
        val udp = Udp.parse(Ipv4.parse(pkt, pkt.size)!!)!!
        assertEquals(5, udp.payloadLength)
        assertEquals(5555, udp.dstPort)
    }

    @Test
    fun malformedPacketsAreRejected() {
        assertEquals(null, Ipv4.parse(ByteArray(10), 10))
        val v6 = ByteArray(40).also { it[0] = 0x60 }
        assertEquals(null, Ipv4.parse(v6, 40))
    }

    @Test
    fun addressClassification() {
        assertTrue(isLocalNetwork(parseIpv4("192.168.1.20")))
        assertTrue(isLocalNetwork(parseIpv4("10.0.0.1")))
        assertTrue(isLocalNetwork(parseIpv4("172.20.1.1")))
        assertFalse(isLocalNetwork(parseIpv4("172.32.1.1")))
        assertFalse(isLocalNetwork(parseIpv4("8.8.8.8")))
        assertTrue(isMulticastOrBroadcast(parseIpv4("224.0.0.251")))
        assertTrue(isMulticastOrBroadcast(parseIpv4("255.255.255.255")))
        assertFalse(isMulticastOrBroadcast(parseIpv4("1.1.1.1")))
    }
}
