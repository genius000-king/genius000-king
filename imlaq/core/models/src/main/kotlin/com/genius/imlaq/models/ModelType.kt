package com.genius.imlaq.models

/**
 * What a model does, in the user's terms. [runsToday] says whether this app can run it now;
 * the others download fine and wait for their engine (docs/PLAN.md, phases 3 and 4).
 */
enum class ModelType(val runsToday: Boolean) {
    /** Chat and writing. */
    TEXT(true),

    /** Chat that can also look at pictures. The text side runs now; reading images comes later. */
    VISION(true),

    /** Draws pictures from a description. */
    IMAGE(false),

    /** Makes video clips. */
    VIDEO(false),

    /** Turns speech into text. */
    SPEECH_TO_TEXT(false),

    /** Reads text aloud. */
    TEXT_TO_SPEECH(false),

    /** Turns text into vectors for search; not something to chat with. */
    EMBEDDING(false),

    UNKNOWN(false),
}

/**
 * Works a model's type out from what is known about it: Hugging Face's own label before a
 * download, the architecture written inside the file after it.
 */
object ModelTypes {

    private val byPipeline = mapOf(
        "text-generation" to ModelType.TEXT,
        "text2text-generation" to ModelType.TEXT,
        "conversational" to ModelType.TEXT,
        "question-answering" to ModelType.TEXT,
        "summarization" to ModelType.TEXT,
        "translation" to ModelType.TEXT,
        "image-text-to-text" to ModelType.VISION,
        "visual-question-answering" to ModelType.VISION,
        "image-to-text" to ModelType.VISION,
        "video-text-to-text" to ModelType.VISION,
        "any-to-any" to ModelType.VISION,
        "text-to-image" to ModelType.IMAGE,
        "image-to-image" to ModelType.IMAGE,
        "unconditional-image-generation" to ModelType.IMAGE,
        "text-to-video" to ModelType.VIDEO,
        "image-to-video" to ModelType.VIDEO,
        "automatic-speech-recognition" to ModelType.SPEECH_TO_TEXT,
        "text-to-speech" to ModelType.TEXT_TO_SPEECH,
        "text-to-audio" to ModelType.TEXT_TO_SPEECH,
        "feature-extraction" to ModelType.EMBEDDING,
        "sentence-similarity" to ModelType.EMBEDDING,
    )

    /** Name fragments, checked when a repo carries no pipeline label. Order matters: first match wins. */
    private val byName = listOf(
        listOf("whisper") to ModelType.SPEECH_TO_TEXT,
        listOf("kokoro", "orpheus", "outetts", "-tts", "tts-", "_tts", "piper") to ModelType.TEXT_TO_SPEECH,
        listOf("wan2", "wan-2", "ltx-video", "ltxv", "hunyuanvideo", "hunyuan-video", "mochi", "cogvideo") to ModelType.VIDEO,
        listOf("flux", "sdxl", "stable-diffusion", "sd3", "sd-3", "sd1.5", "sd-1.5", "hidream", "chroma", "qwen-image", "auraflow", "lumina") to ModelType.IMAGE,
        listOf("-vl", "_vl", "vision", "llava", "mmproj", "pixtral", "minicpm-v", "smolvlm") to ModelType.VISION,
        listOf("embed", "bge-", "e5-", "gte-", "minilm") to ModelType.EMBEDDING,
    )

    fun fromHub(pipelineTag: String?, tags: List<String>, id: String): ModelType {
        pipelineTag?.let { byPipeline[it] }?.let { return it }
        tags.firstNotNullOfOrNull { byPipeline[it] }?.let { return it }
        val name = id.lowercase()
        byName.firstOrNull { (keys, _) -> keys.any { it in name } }?.let { return it.second }
        return ModelType.UNKNOWN
    }

    private val ggufImage = setOf("flux", "sd1", "sd2", "sdxl", "sd3", "aura", "hidream", "chroma", "lumina2", "qwen_image", "stable-diffusion")
    private val ggufVideo = setOf("wan", "ltxv", "hyvid", "hunyuan_video", "cosmos", "mochi")
    private val ggufEmbedding = setOf("bert", "nomic-bert", "nomic-bert-moe", "jina-bert-v2", "jina-bert-v3", "neo-bert", "modern-bert", "t5encoder")
    private val ggufTts = setOf("wavtokenizer-dec")

    fun fromGguf(architecture: String, kind: ModelKind): ModelType {
        val arch = architecture.lowercase()
        return when {
            kind == ModelKind.VISION_PROJECTOR -> ModelType.VISION
            arch == "whisper" -> ModelType.SPEECH_TO_TEXT
            arch in ggufTts -> ModelType.TEXT_TO_SPEECH
            arch in ggufImage -> ModelType.IMAGE
            arch in ggufVideo -> ModelType.VIDEO
            arch in ggufEmbedding -> ModelType.EMBEDDING
            kind == ModelKind.TEXT_MOE || kind == ModelKind.TEXT_DENSE -> ModelType.TEXT
            else -> ModelType.UNKNOWN
        }
    }
}
