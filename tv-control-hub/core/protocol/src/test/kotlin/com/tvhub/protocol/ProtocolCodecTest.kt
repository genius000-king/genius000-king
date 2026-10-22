package com.tvhub.protocol

import com.tvhub.common.AppResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.fail

class ProtocolCodecTest {

    @Test
    fun `hello encodes to the documented wire format`() {
        val text = ProtocolCodec.encode(Hello(protocolVersion = 1, peerId = "phone-1", role = PeerRole.MOBILE))

        assertEquals("""{"type":"hello","protocolVersion":1,"peerId":"phone-1","role":"mobile"}""", text)
    }

    @Test
    fun `every message type survives a round trip`() {
        val messages = listOf(
            Hello(protocolVersion = 1, peerId = "phone-1", role = PeerRole.MOBILE),
            HelloAck(protocolVersion = 1, peerId = "tv-1"),
            Reject(code = RejectCode.REVOKED, message = "device was removed"),
            Ping(sequence = 7, sentAtMillis = 1_700_000_000_000L),
            Pong(sequence = 7, sentAtMillis = 1_700_000_000_000L),
        )

        messages.forEach { original ->
            assertEquals(original, decodeOrFail(ProtocolCodec.encode(original)))
        }
    }

    @Test
    fun `every encoded type is listed as known`() {
        val samples = listOf(
            Hello(1, "a", PeerRole.TV),
            HelloAck(1, "b"),
            Reject(RejectCode.RATE_LIMITED, "slow down"),
            Ping(1, 1),
            Pong(1, 1),
        )

        val encodedTypes = samples.map { sample ->
            ProtocolCodec.encode(sample).substringAfter("\"type\":\"").substringBefore("\"")
        }.toSet()

        assertEquals(ProtocolCodec.KNOWN_MESSAGE_TYPES, encodedTypes)
    }

    @Test
    fun `unknown message type decodes to UnknownMessage instead of failing`() {
        val decoded = ProtocolCodec.decode("""{"type":"future_feature","payload":{"a":1}}""")

        assertEquals(AppResult.Success(UnknownMessage("future_feature")), decoded)
    }

    @Test
    fun `unknown fields on a known message are ignored`() {
        val decoded = ProtocolCodec.decode("""{"type":"ping","sequence":3,"sentAtMillis":10,"extra":"x"}""")

        assertEquals(AppResult.Success(Ping(sequence = 3, sentAtMillis = 10)), decoded)
    }

    @Test
    fun `message without a type fails with the missing type code`() {
        val failure = assertIs<AppResult.Failure>(ProtocolCodec.decode("""{"sequence":1}"""))

        assertEquals(ProtocolCodec.ERROR_MISSING_TYPE, failure.error.code)
    }

    @Test
    fun `non-string type fails with the missing type code`() {
        val failure = assertIs<AppResult.Failure>(ProtocolCodec.decode("""{"type":42}"""))

        assertEquals(ProtocolCodec.ERROR_MISSING_TYPE, failure.error.code)
    }

    @Test
    fun `invalid JSON fails as malformed`() {
        val failure = assertIs<AppResult.Failure>(ProtocolCodec.decode("{not json"))

        assertEquals(ProtocolCodec.ERROR_MALFORMED, failure.error.code)
    }

    @Test
    fun `JSON array is rejected as malformed`() {
        val failure = assertIs<AppResult.Failure>(ProtocolCodec.decode("[1,2,3]"))

        assertEquals(ProtocolCodec.ERROR_MALFORMED, failure.error.code)
    }

    @Test
    fun `known message with a wrong field type fails as malformed`() {
        val failure = assertIs<AppResult.Failure>(
            ProtocolCodec.decode("""{"type":"ping","sequence":"abc","sentAtMillis":1}"""),
        )

        assertEquals(ProtocolCodec.ERROR_MALFORMED, failure.error.code)
    }

    @Test
    fun `unknown enum value inside a known message is rejected, not guessed`() {
        val failure = assertIs<AppResult.Failure>(
            ProtocolCodec.decode("""{"type":"reject","code":"quota_exceeded","message":"x"}"""),
        )

        assertEquals(ProtocolCodec.ERROR_MALFORMED, failure.error.code)
    }

    private fun decodeOrFail(text: String): ProtocolMessage =
        when (val result = ProtocolCodec.decode(text)) {
            is AppResult.Success -> result.value
            is AppResult.Failure -> fail("Expected success for '$text' but got ${result.error.code}")
        }
}
