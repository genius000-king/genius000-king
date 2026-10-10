package com.genius.imlaq.engine.host.moe

import com.genius.imlaq.engine.EngineState
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * MoeTextEngine against a fake engine: a shell script speaking bmoe-cli's session protocol.
 * Hermetic (no native build), and it can misbehave on purpose.
 */
class MoeTextEngineTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @After
    fun tearDown() = scope.cancel()

    /**
     * Before every real answer the script replays the tail of an older, cancelled turn (id + 100):
     * BEGIN, PROGRESS and DONE that belong to someone else and must be dropped.
     */
    private fun fakeEngine(exitAfterFirstTurn: Boolean = false): File = tmp.newFile("fake-bmoe.sh").apply {
        writeText(
            """
            |#!/bin/bash
            |echo 'BMOE_READY {"load_s":0.1,"arch":"fake","n_ctx":512,"think_ctl":"none","n_expert_used":2}'
            |while IFS= read -r line; do
            |  case "${'$'}line" in
            |    *'"cmd":"generate"'*)
            |      id=${'$'}(echo "${'$'}line" | sed -E 's/.*"id":([0-9]+).*/\1/')
            |      old=${'$'}((id + 100))
            |      echo "BMOE_BEGIN {\"id\":${'$'}old}"
            |      echo 'BMOE_PROGRESS {"step":9,"delta_reasoning":"","delta_text":"stale"}'
            |      echo "BMOE_DONE {\"id\":${'$'}old,\"cancelled\":true,\"tokens\":1,\"tok_s\":1,\"prefill_s\":0,\"text\":\"stale\",\"reasoning\":\"\"}"
            |      echo "BMOE_BEGIN {\"id\":${'$'}id}"
            |      echo 'llama_log: a log line that is not an event'
            |      echo 'BMOE_PROGRESS {"step":1,"delta_reasoning":"","delta_text":"مرحبا "}'
            |      echo "BMOE_PROGRESS {\"step\":2,\"delta_reasoning\":\"\",\"delta_text\":\"${'$'}id\"}"
            |      echo "BMOE_DONE {\"id\":${'$'}id,\"cancelled\":false,\"tokens\":2,\"tok_s\":3.5,\"prefill_s\":0.1,\"text\":\"مرحبا ${'$'}id\",\"reasoning\":\"\"}"
            |      ${if (exitAfterFirstTurn) "echo 'fatal: out of memory' >&2; exit 3" else ":"}
            |      ;;
            |    *'"cmd":"close"'*) exit 0 ;;
            |  esac
            |done
            """.trimMargin(),
        )
        setExecutable(true)
    }

    private fun engine(script: File) = MoeTextEngine(script, tmp.root, tmp.newFolder(), scope)

    @Test
    fun streamsOnlyTheCurrentTurnAndStaysReady() = runBlocking {
        val e = engine(fakeEngine())
        withTimeout(10_000) { e.load(File("model.gguf")) }
        assertEquals("fake", (e.state.value as EngineState.Ready).info["arch"])

        val first = withTimeout(10_000) { e.generate(TextRequest("hi", newConversation = true)).toList() }
        val text = first.filterIsInstance<TextEvent.Delta>().joinToString("") { it.text }
        assertEquals("مرحبا 1", text)
        assertEquals("مرحبا 1", (first.last() as TextEvent.Finished).text)
        assertTrue("stale events leaked: $first", first.none { it is TextEvent.Delta && it.text == "stale" })
        assertTrue(e.state.value is EngineState.Ready)

        val second = withTimeout(10_000) { e.generate(TextRequest("again")).toList() }
        assertEquals("مرحبا 2", (second.last() as TextEvent.Finished).text)

        e.unload()
        assertEquals(EngineState.Idle, e.state.value)
    }

    @Test
    fun anEngineThatDiesReportsWhyAndRefusesTheNextTurn() = runBlocking {
        val e = engine(fakeEngine(exitAfterFirstTurn = true))
        withTimeout(10_000) { e.load(File("model.gguf")) }
        withTimeout(10_000) { e.generate(TextRequest("hi", newConversation = true)).toList() }
        withTimeout(10_000) { while (e.state.value !is EngineState.Failed) kotlinx.coroutines.delay(20) }
        val failed = e.state.value as EngineState.Failed
        assertTrue(failed.message, failed.message.contains("out of memory"))

        val next = withTimeout(10_000) { e.generate(TextRequest("still there?")).toList() }
        assertTrue(next.single() is TextEvent.Failed)
    }
}
