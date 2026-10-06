package com.genius.imlaq.common

import org.junit.Assert.assertEquals
import org.junit.Test

class BytesTest {

    @Test
    fun unitsConvertExactly() {
        assertEquals(1024L * 1024 * 1024, Bytes.gib(1).value)
        assertEquals(1536L, Bytes.gib(1.5).wholeMib)
        assertEquals(2048L, (Bytes.gib(1) + Bytes.gib(1)).wholeMib)
    }

    @Test
    fun negativeBudgetsClampToZero() {
        assertEquals(Bytes.ZERO, (Bytes.mib(100) - Bytes.mib(300)).coerceAtLeastZero())
    }

    @Test
    fun readableFormatPicksTheLargestUnit() {
        assertEquals("1.5 GiB", Bytes.gib(1.5).toString())
        assertEquals("512 MiB", Bytes.mib(512).toString())
        assertEquals("12 B", Bytes(12).toString())
    }

    @Test
    fun sumAddsEveryElement() {
        assertEquals(Bytes.mib(6), listOf(Bytes.mib(1), Bytes.mib(2), Bytes.mib(3)).sum())
    }
}
