package com.genius.imlaq.engine.host.moe

import com.genius.imlaq.common.Bytes
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class BmoeProtocolTest {

    private fun events(line: String) = BmoeProtocol.toTextEvents(BmoeProtocol.parser.parse(line)!!)

    @Test
    fun generateCommandIsValidJsonWithEscapedPrompt() {
        val cmd = BmoeProtocol.generate(7, TextRequest(prompt = "قل \"مرحبا\"\nثم توقف", maxTokens = 64, newConversation = true))
        val o = Json.parseToJsonElement(cmd).jsonObject
        assertEquals("generate", o["cmd"]!!.jsonPrimitive.content)
        assertEquals("7", o["id"]!!.jsonPrimitive.content)
        assertEquals("قل \"مرحبا\"\nثم توقف", o["prompt"]!!.jsonPrimitive.content)
        assertEquals("true", o["clear_kv"]!!.jsonPrimitive.content)
    }

    @Test
    fun progressBecomesADeltaAndTelemetry() {
        val out = events("""BMOE_PROGRESS {"step":12,"steps":64,"wall_ms":510.2,"io_ms":300.1,"compute_ms":190.0,"read_mb":88.5,"cache_hit_pct":71.0,"delta_reasoning":"","delta_text":"مرحبا"}""")
        assertEquals(TextEvent.Delta("مرحبا", "", replace = false), out[0])
        val t = out[1] as TextEvent.Telemetry
        assertEquals(12, t.step)
        assertEquals(71.0, t.cacheHitPct, 0.0)
    }

    @Test
    fun resetMeansReplaceNotAppend() {
        val d = events("""BMOE_PROGRESS {"step":1,"reset":1,"delta_reasoning":"thinking","delta_text":""}""")[0]
        assertTrue((d as TextEvent.Delta).replace)
    }

    @Test
    fun doneCarriesTheFinalTextAndSpeed() {
        val f = events("""BMOE_DONE {"id":1,"cancelled":false,"tokens":40,"tok_s":1.9,"prefill_s":3.2,"text":"تم","reasoning":""}""")[0] as TextEvent.Finished
        assertEquals("تم", f.text)
        assertEquals(40, f.tokens)
        assertEquals(1.9, f.tokensPerSecond, 0.0)
        assertFalse(f.cancelled)
    }

    @Test
    fun errorsKeepTheirFatality() {
        val e = events("""BMOE_ERROR {"id":0,"fatal":true,"msg":"model not found"}""")[0] as TextEvent.Failed
        assertEquals("model not found", e.message)
        assertTrue(e.fatal)
    }

    @Test
    fun argvStreamsExpertsWithTheCacheFloorTheUserChose() {
        val argv = BmoeArgs.build(
            File("/lib/libimlaq_text.so"), File("/models/m.gguf"),
            MoeLaunchConfig(cache = ExpertCache.Auto(floor = Bytes.gib(2)), threads = 6),
        )
        assertEquals("/lib/libimlaq_text.so", argv.first())
        assertTrue(argv.containsAll(listOf("--session", "--moe-stream", "--chatml")))
        assertEquals("2048", argv[argv.indexOf("--cache-floor-mb") + 1])
        assertEquals("6", argv[argv.indexOf("-t") + 1])
        assertEquals("anon", argv[argv.indexOf("--dense-weights") + 1])
    }

    @Test
    fun aSmallFixedCacheIsForcedAndDenseModelsSkipStreaming() {
        val small = BmoeArgs.build(File("x"), File("m"), MoeLaunchConfig(cache = ExpertCache.Fixed(Bytes.mib(800))))
        assertTrue(small.contains("--force-cache"))
        val dense = BmoeArgs.build(File("x"), File("m"), MoeLaunchConfig(streamExperts = false))
        assertFalse(dense.contains("--moe-stream"))
        assertFalse(dense.contains("--cache-mb"))
    }

    @Test
    fun grantBecomesTheCacheLeftAfterDenseKvAndOverhead() {
        val c = BmoeArgs.cacheFromGrant(Bytes.gib(6), denseWeights = Bytes.gib(3), kvCache = Bytes.mib(624))
        assertEquals(Bytes.gib(6) - Bytes.gib(3) - Bytes.mib(624) - Bytes.mib(400), c.size)
    }
}
