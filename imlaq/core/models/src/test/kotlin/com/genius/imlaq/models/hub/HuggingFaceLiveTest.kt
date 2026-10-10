package com.genius.imlaq.models.hub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Against the real huggingface.co, so a change in their API shows up here first.
 * Skipped unless IMLAQ_LIVE_HF=1 (the normal test run stays offline).
 */
class HuggingFaceLiveTest {

    private val live = System.getenv("IMLAQ_LIVE_HF") == "1"

    @Test
    fun searchAndListARealRepo() {
        assumeTrue(live)
        val hf = HuggingFace()
        val repos = hf.search("Qwen3-30B-A3B")
        assertTrue("no results", repos.isNotEmpty())

        val files = hf.files("unsloth/Qwen3-30B-A3B-GGUF")
        val q4 = files.first { it.label == "Qwen3-30B-A3B-Q4_K_M" }
        assertEquals(18_556_686_912L, q4.totalBytes) // the size BigMoeOnEdge's catalog downloads

        val link = DirectLink.inspect(q4.files.single().source)
        assertEquals("Qwen3-30B-A3B-Q4_K_M.gguf", link.name)
        assertEquals(18_556_686_912L, link.bytes)
    }
}
