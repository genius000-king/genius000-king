package com.tvhub.protocol

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ProtocolVersionTest {

    @Test
    fun `same version is negotiated as itself`() {
        assertEquals(PROTOCOL_VERSION, negotiateProtocolVersion(PROTOCOL_VERSION))
    }

    @Test
    fun `newer peer is served at our version`() {
        assertEquals(PROTOCOL_VERSION, negotiateProtocolVersion(PROTOCOL_VERSION + 5))
    }

    @Test
    fun `peer below the minimum supported version is refused`() {
        assertNull(negotiateProtocolVersion(MIN_SUPPORTED_PROTOCOL_VERSION - 1))
    }
}
