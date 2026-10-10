package com.genius.imlaq.engine.host.moe

import com.genius.imlaq.engine.RunnerEvent
import com.genius.imlaq.engine.RunnerLineParser
import com.genius.imlaq.engine.TextEvent
import com.genius.imlaq.engine.TextRequest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * bmoe-cli's `--session` protocol (BigMoeOnEdge docs/telemetry.md), mapped onto [TextEvent].
 * Pure functions only, so the whole mapping is unit-tested on the JVM.
 */
object BmoeProtocol {

    val parser = RunnerLineParser("BMOE")

    const val CANCEL = """{"cmd":"cancel"}"""
    const val CLOSE = """{"cmd":"close"}"""

    fun generate(id: Int, r: TextRequest): String = buildJsonObject {
        put("cmd", "generate")
        put("id", id)
        put("n_predict", r.maxTokens)
        put("think", r.think)
        put("clear_kv", r.newConversation)
        put("prompt", r.prompt)
    }.toString()

    /** READY's payload, flattened for [com.genius.imlaq.engine.EngineState.Ready]. */
    fun readyInfo(e: RunnerEvent): Map<String, String> =
        e.payload.mapValues { (_, v) -> v.toString().trim('"') }

    /** Maps one turn event. READY and unknown events map to nothing. */
    fun toTextEvents(e: RunnerEvent): List<TextEvent> = when (e.name) {
        "BEGIN" -> listOf(TextEvent.Started)
        "PROGRESS" -> listOf(
            TextEvent.Delta(
                text = e.string("delta_text").orEmpty(),
                reasoning = e.string("delta_reasoning").orEmpty(),
                replace = e.bool("reset") == true,
            ),
            TextEvent.Telemetry(
                step = e.int("step") ?: 0,
                wallMs = e.double("wall_ms") ?: 0.0,
                ioMs = e.double("io_ms") ?: 0.0,
                computeMs = e.double("compute_ms") ?: 0.0,
                readMb = e.double("read_mb") ?: 0.0,
                cacheHitPct = e.double("cache_hit_pct") ?: 0.0,
            ),
        )
        "DONE" -> listOf(
            TextEvent.Finished(
                text = e.string("text").orEmpty(),
                reasoning = e.string("reasoning").orEmpty(),
                tokens = e.int("tokens") ?: 0,
                tokensPerSecond = e.double("tok_s") ?: 0.0,
                prefillSeconds = e.double("prefill_s") ?: 0.0,
                cancelled = e.bool("cancelled") == true,
            ),
        )
        "ERROR" -> listOf(TextEvent.Failed(e.string("msg") ?: "engine error", e.bool("fatal") == true))
        else -> emptyList()
    }
}
