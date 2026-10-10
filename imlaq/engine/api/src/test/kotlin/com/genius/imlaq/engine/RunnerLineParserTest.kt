package com.genius.imlaq.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RunnerLineParserTest {

    private val bmoe = RunnerLineParser("BMOE")

    @Test
    fun parsesAnEventWithItsPayload() {
        val e = bmoe.parse("""BMOE_READY {"load_s":2.5,"arch":"qwen3moe","n_ctx":4096,"n_expert_used":8}""")!!
        assertEquals("READY", e.name)
        assertEquals("qwen3moe", e.string("arch"))
        assertEquals(4096, e.int("n_ctx"))
        assertEquals(2.5, e.double("load_s")!!, 0.0)
    }

    @Test
    fun readsNumericFlagsAsBooleans() {
        val e = bmoe.parse("""BMOE_PROGRESS {"step":3,"reset":1,"delta_text":"x"}""")!!
        assertEquals(true, e.bool("reset"))
    }

    @Test
    fun logLinesAndOtherPrefixesAreNotEvents() {
        assertNull(bmoe.parse("llama_model_loader: loaded meta data"))
        assertNull(bmoe.parse("""IMQ_READY {}"""))
    }

    @Test
    fun malformedJsonIsTreatedAsALogLine() {
        assertNull(bmoe.parse("BMOE_DONE {not json"))
    }

    @Test
    fun anEventWithoutBodyHasAnEmptyPayload() {
        val e = bmoe.parse("BMOE_PING")!!
        assertEquals("PING", e.name)
        assertEquals(0, e.payload.size)
    }

    @Test
    fun escapedTextSurvivesTheRoundTrip() {
        val e = bmoe.parse("""BMOE_PROGRESS {"delta_text":"سطر\nثاني \"اقتباس\""}""")!!
        assertEquals("سطر\nثاني \"اقتباس\"", e.string("delta_text"))
    }
}
