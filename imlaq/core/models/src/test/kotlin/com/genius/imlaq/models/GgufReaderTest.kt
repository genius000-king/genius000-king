package com.genius.imlaq.models

import com.genius.imlaq.common.Bytes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class GgufReaderTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun moe() = FakeGguf()
        .string("general.architecture", "qwen3moe")
        .string("general.name", "Tiny MoE")
        .u32("qwen3moe.block_count", 2)
        .u32("qwen3moe.context_length", 4096)
        .u32("qwen3moe.expert_count", 8)
        .u32("qwen3moe.expert_used_count", 2)
        .stringArray("tokenizer.ggml.tokens", List(1000) { "tok$it" })
        .tensor("token_embd.weight", 4096)
        .tensor("blk.0.attn_q.weight", 1024)
        .tensor("blk.0.ffn_gate_exps.weight", 8192)
        .tensor("blk.0.ffn_down_exps.weight", 8192)

    @Test
    fun readsMetadataAndSkipsLargeArrays() {
        val h = GgufReader.read(moe().writeTo(tmp.newFile("m.gguf")))
        assertEquals(3, h.version)
        assertEquals("qwen3moe", h.string("general.architecture"))
        assertEquals(8L, h.long("qwen3moe.expert_count"))
        assertEquals(GgufArray(8, 1000), h.metadata["tokenizer.ggml.tokens"])
        assertEquals(4, h.tensors.size)
    }

    @Test
    fun tensorSizesComeFromOffsets() {
        val h = GgufReader.read(moe().writeTo(tmp.newFile("m.gguf")))
        val sizes = h.tensorSizes()
        assertEquals(4096L, sizes["token_embd.weight"])
        assertEquals(8192L, sizes["blk.0.ffn_down_exps.weight"])
    }

    @Test
    fun splitsExpertFromDenseWeights() {
        val s = ModelSummary.from(listOf(GgufReader.read(moe().writeTo(tmp.newFile("m.gguf")))))
        assertEquals(ModelKind.TEXT_MOE, s.kind)
        assertEquals(Bytes(16384), s.expertBytes)
        assertEquals(Bytes(4096 + 1024), s.denseBytes)
        // dense + 2/8 of the experts
        assertEquals(Bytes(5120 + 4096), s.activeBytesPerToken)
    }

    @Test
    fun recognisesDenseModelsAndVisionProjectors() {
        val dense = FakeGguf().string("general.architecture", "llama").u32("llama.block_count", 2)
            .tensor("blk.0.ffn_up.weight", 512).writeTo(tmp.newFile("d.gguf"))
        val mmproj = FakeGguf().string("general.architecture", "clip")
            .tensor("v.patch_embd.weight", 512).writeTo(tmp.newFile("p.gguf"))
        assertEquals(ModelKind.TEXT_DENSE, ModelSummary.from(listOf(GgufReader.read(dense))).kind)
        assertEquals(ModelKind.VISION_PROJECTOR, ModelSummary.from(listOf(GgufReader.read(mmproj))).kind)
    }

    @Test(expected = GgufFormatException::class)
    fun rejectsNonGgufFiles() {
        GgufReader.read(tmp.newFile("x.gguf").apply { writeText("definitely not gguf") })
    }

    @Test
    fun storeGroupsShardsAndFlagsIncompleteSets() {
        val dir = tmp.newFolder("models")
        moe().writeTo(dir.resolve("big-00001-of-00002.gguf"))
        FakeGguf().tensor("blk.1.ffn_up_exps.weight", 8192).writeTo(dir.resolve("big-00002-of-00002.gguf"))
        moe().writeTo(dir.resolve("broken-00001-of-00003.gguf"))
        moe().writeTo(dir.resolve("single.gguf"))

        val models = ModelStore(dir).list().associateBy { it.entry.name }
        val big = models.getValue("big-00001-of-00002.gguf")
        assertTrue(big.complete)
        assertEquals(2, big.shards.size)
        assertEquals(Bytes(16384 + 8192), big.summary!!.expertBytes)

        val broken = models.getValue("broken-00001-of-00003.gguf")
        assertNull(broken.summary)
        assertEquals("missing shards: 1 of 3", broken.error)

        assertTrue(models.getValue("single.gguf").complete)
    }
}
