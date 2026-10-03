package com.genius.saraat.engine

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.channels.Channels

class BuffersTest {
    @Test
    fun ringKeepsOrderAcrossTheWrapPoint() {
        val ring = ByteRing(8)
        assertEquals(6, ring.write(byteArrayOf(1, 2, 3, 4, 5, 6), 0, 6))
        ring.drop(4)                                       // head moves to 4
        assertEquals(6, ring.write(byteArrayOf(7, 8, 9, 10, 11, 12), 0, 6)) // wraps
        assertEquals(8, ring.size)
        val out = ByteArray(8)
        ring.copyTo(0, out, 0, 8)
        assertArrayEquals(byteArrayOf(5, 6, 7, 8, 9, 10, 11, 12), out)
        assertEquals(0, ring.write(byteArrayOf(99), 0, 1)) // full
    }

    @Test
    fun ringTalksToChannels() {
        val ring = ByteRing(16)
        val data = ByteArray(10) { it.toByte() }
        assertEquals(10, ring.readFrom(Channels.newChannel(ByteArrayInputStream(data)), 100))
        val sink = ByteArrayOutputStream()
        assertEquals(10, ring.writeTo(Channels.newChannel(sink), 100))
        assertArrayEquals(data, sink.toByteArray())
        assertEquals(0, ring.size)
        assertEquals(-1, ring.readFrom(Channels.newChannel(ByteArrayInputStream(ByteArray(0))), 10)) // EOF
    }

    @Test
    fun bucketBurstIsBoundedAndSpendable() {
        val bucket = TokenBucket().apply { rate = 100_000 }
        val t0 = 1_000_000_000L
        val burst = bucket.available(t0)
        assertTrue("burst $burst", burst in 8_192..10_000)
        bucket.consume(burst)
        assertEquals(0L, bucket.available(t0))
        // 50 ms later: 5000 bytes
        val later = bucket.available(t0 + 50_000_000L)
        assertTrue("refill $later", later in 4_900..5_100)
        // never exceeds capacity even after a long pause
        assertTrue(bucket.available(t0 + 60_000_000_000L) <= 10_000)
    }

    @Test
    fun unlimitedBucketNeverBlocks() {
        val bucket = TokenBucket()
        assertEquals(Long.MAX_VALUE, bucket.available(1))
        assertEquals(0L, bucket.nanosUntil(1_000_000, 1))
    }
}
