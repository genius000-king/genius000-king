package com.genius.imlaq.engine.host.moe

import com.genius.imlaq.common.Bytes
import com.genius.imlaq.engine.EngineState
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import com.genius.imlaq.models.ModelKind
import com.genius.imlaq.models.ModelStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Drives the REAL engine, not a fake: a host build of bmoe-cli streaming a tiny MoE model.
 * Skipped unless both are provided, so the normal test run stays hermetic:
 *
 *   IMLAQ_HOST_ENGINE=build-native/host/cli/bmoe-cli \
 *   IMLAQ_TINY_MOE=/path/tiny-moe.gguf ./gradlew :engine:host:testDebugUnitTest
 *
 * The tiny model comes from third_party/bigmoeonedge/scripts/make-tiny-moe.py.
 */
class MoeTextEngineIntegrationTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val engineBinary = System.getenv("IMLAQ_HOST_ENGINE")?.let(::File)?.takeIf { it.canExecute() }
    private val tinyModel = System.getenv("IMLAQ_TINY_MOE")?.let(::File)?.takeIf { it.isFile }

    @Test
    fun loadsStreamsTwoTurnsAndUnloads() = runBlocking {
        assumeTrue("set IMLAQ_HOST_ENGINE and IMLAQ_TINY_MOE to run", engineBinary != null && tinyModel != null)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val engine = MoeTextEngine(engineBinary!!, engineBinary.parentFile, tmp.newFolder("work"), scope)
        engine.launchConfig = MoeLaunchConfig(
            contextSize = 256,
            threads = 2,
            cache = ExpertCache.Fixed(Bytes.mib(2)), // smaller than the experts: real evictions
            ioThreads = 2,
        )
        try {
            withTimeout(60_000) { engine.load(tinyModel!!) }
            val ready = engine.state.value
            assertTrue("state after load: $ready", ready is EngineState.Ready)
            assertEquals("qwen3moe", (ready as EngineState.Ready).info["arch"])

            val first = withTimeout(60_000) {
                engine.generate(TextRequest("hello", maxTokens = 8, think = false, newConversation = true)).toList()
            }
            assertTrue("no Started in $first", first.first() is TextEvent.Started)
            assertTrue("no telemetry in $first", first.any { it is TextEvent.Telemetry })
            val done = first.last() as TextEvent.Finished
            assertTrue("tokens=${done.tokens}", done.tokens in 1..8)
            val streamed = first.filterIsInstance<TextEvent.Delta>().joinToString("") { it.text }
            assertEquals("deltas must add up to the final text", done.text, streamed)
            assertTrue(engine.state.value is EngineState.Ready)

            // Continue the same conversation: the session process stays warm.
            val second = withTimeout(60_000) {
                engine.generate(TextRequest("again", maxTokens = 4, think = false)).toList()
            }
            assertTrue("second turn: $second", second.last() is TextEvent.Finished)

            engine.unload()
            assertEquals(EngineState.Idle, engine.state.value)
        } finally {
            engine.unload()
            scope.cancel()
        }
    }

    @Test
    fun aMissingModelFailsTheLoadWithTheEnginesReason() = runBlocking {
        assumeTrue("set IMLAQ_HOST_ENGINE to run", engineBinary != null)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val engine = MoeTextEngine(engineBinary!!, engineBinary.parentFile, tmp.newFolder("work"), scope)
        try {
            withTimeout(30_000) { engine.load(File(tmp.root, "nope.gguf")) }
            assertTrue("state: ${engine.state.value}", engine.state.value is EngineState.Failed)
        } finally {
            engine.unload()
            scope.cancel()
        }
    }

    @Test
    fun readerAgreesWithTheRealGgufWriter() {
        assumeTrue("set IMLAQ_TINY_MOE to run", tinyModel != null)
        val dir = tinyModel!!.parentFile
        val models = ModelStore(dir).list()
        val single = models.first { it.entry == tinyModel }
        val s = single.summary!!
        assertEquals(ModelKind.TEXT_MOE, s.kind)
        assertEquals(8, s.expertCount)
        assertEquals(2, s.expertUsedCount)
        assertTrue("experts dominate a MoE: $s", s.expertBytes > s.denseBytes)
        // Tensor bytes account for the whole file except the header.
        assertTrue(s.totalBytes.value in (tinyModel.length() - 64 * 1024)..tinyModel.length())

        // The sharded copy (metadata-only first shard, like unsloth's uploads) sums to the same.
        val shardedDir = File(dir, "sharded")
        if (shardedDir.isDirectory) {
            val sharded = ModelStore(shardedDir).list().single()
            assertEquals(4, sharded.shards.size)
            assertEquals(s.expertBytes.value.toDouble(), sharded.summary!!.expertBytes.value.toDouble(), 64.0 * 1024)
        }
    }
}
