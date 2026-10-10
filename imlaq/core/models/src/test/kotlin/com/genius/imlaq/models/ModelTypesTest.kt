package com.genius.imlaq.models

import com.genius.imlaq.models.download.DownloadSpec
import com.genius.imlaq.models.download.TransferFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelTypesTest {

    @Test
    fun huggingFacesOwnLabelWins() {
        assertEquals(ModelType.TEXT, ModelTypes.fromHub("text-generation", emptyList(), "unsloth/Qwen3-30B-A3B-GGUF"))
        assertEquals(ModelType.VISION, ModelTypes.fromHub("image-text-to-text", emptyList(), "unsloth/gemma-3-27b-it-GGUF"))
        assertEquals(ModelType.IMAGE, ModelTypes.fromHub("text-to-image", emptyList(), "city96/FLUX.1-dev-gguf"))
        assertEquals(ModelType.VIDEO, ModelTypes.fromHub("text-to-video", emptyList(), "city96/Wan2.1-T2V-14B-gguf"))
        assertEquals(ModelType.SPEECH_TO_TEXT, ModelTypes.fromHub("automatic-speech-recognition", emptyList(), "x/y"))
        assertEquals(ModelType.TEXT_TO_SPEECH, ModelTypes.fromHub("text-to-speech", emptyList(), "x/y"))
    }

    @Test
    fun withoutALabelTheTagsThenTheNameDecide() {
        assertEquals(ModelType.VISION, ModelTypes.fromHub(null, listOf("gguf", "image-text-to-text"), "x/y"))
        assertEquals(ModelType.IMAGE, ModelTypes.fromHub(null, listOf("gguf"), "city96/FLUX.1-schnell-gguf"))
        assertEquals(ModelType.SPEECH_TO_TEXT, ModelTypes.fromHub(null, emptyList(), "ggerganov/whisper.cpp"))
        assertEquals(ModelType.VIDEO, ModelTypes.fromHub(null, emptyList(), "QuantStack/Wan2.2-T2V-A14B-GGUF"))
        assertEquals(ModelType.UNKNOWN, ModelTypes.fromHub(null, listOf("gguf"), "mudler/locate-anything.cpp-gguf"))
    }

    @Test
    fun theArchitectureInsideTheFileDecidesAfterDownload() {
        assertEquals(ModelType.TEXT, ModelTypes.fromGguf("qwen3moe", ModelKind.TEXT_MOE))
        assertEquals(ModelType.TEXT, ModelTypes.fromGguf("llama", ModelKind.TEXT_DENSE))
        // diffusion files carry a block count too: the architecture must win over "looks like text"
        assertEquals(ModelType.IMAGE, ModelTypes.fromGguf("flux", ModelKind.TEXT_DENSE))
        assertEquals(ModelType.VIDEO, ModelTypes.fromGguf("wan", ModelKind.OTHER))
        assertEquals(ModelType.VISION, ModelTypes.fromGguf("clip", ModelKind.VISION_PROJECTOR))
        assertEquals(ModelType.EMBEDDING, ModelTypes.fromGguf("nomic-bert", ModelKind.TEXT_DENSE))
        assertEquals(ModelType.UNKNOWN, ModelTypes.fromGguf("mystery", ModelKind.OTHER))
    }

    @Test
    fun onlyTextModelsRunToday() {
        assertTrue(ModelType.TEXT.runsToday)
        assertTrue(ModelType.VISION.runsToday)
        assertFalse(ModelType.IMAGE.runsToday)
        assertFalse(ModelType.VIDEO.runsToday)
    }

    @Test
    fun aTransferRemembersItsType() {
        val spec = DownloadSpec("hf:a:b", "b", listOf(TransferFile("b.gguf", "https://x", 1)), ModelType.IMAGE)
        assertEquals(ModelType.IMAGE, DownloadSpec.decode(spec.encode()).type)
        // specs queued by an older build, before the type existed, still decode
        assertEquals(ModelType.UNKNOWN, DownloadSpec.decode("""{"id":"a","title":"b","files":[]}""").type)
    }
}
