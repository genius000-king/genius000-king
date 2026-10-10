package com.genius.imlaq.engine

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/** What kind of work an engine does. One app, one interface per modality. */
enum class Modality {
    TEXT,
    SPEECH_TO_TEXT,
    TEXT_TO_SPEECH,
    IMAGE_GENERATION,
}

sealed interface EngineState {
    data object Idle : EngineState
    data class Loading(val progress: Float? = null) : EngineState
    data class Ready(val info: Map<String, String> = emptyMap()) : EngineState
    data object Busy : EngineState
    data class Failed(val message: String) : EngineState
}

/**
 * Every engine lives in its own native process (see docs/ARCHITECTURE.md): loading starts the
 * process and pays the model load once, unloading ends it and gives every byte back to the OS.
 */
interface Engine {
    val id: String
    val modality: Modality
    val state: StateFlow<EngineState>

    suspend fun load(model: File)
    suspend fun unload()
}

// ── text (chat models: MoE giants streamed from flash, dense models, and vision input) ──

data class TextRequest(
    val prompt: String,
    val maxTokens: Int = 1024,
    val think: Boolean = true,
    /** true = start a new conversation (clear the KV cache); false = continue the current one. */
    val newConversation: Boolean = false,
    /** Images for vision-capable models. Ignored (with a warning event) by text-only engines. */
    val images: List<File> = emptyList(),
)

sealed interface TextEvent {
    data object Started : TextEvent

    /**
     * New text since the previous event. [replace] means the engine re-classified earlier
     * output (e.g. answer text that turned out to be reasoning) and the reader must REPLACE
     * its buffers with these values instead of appending them.
     */
    data class Delta(val text: String, val reasoning: String, val replace: Boolean) : TextEvent

    /** Per-token measurements — what makes "storage as RAM" visible to the user. */
    data class Telemetry(
        val step: Int,
        val wallMs: Double,
        val ioMs: Double,
        val computeMs: Double,
        val readMb: Double,
        val cacheHitPct: Double,
    ) : TextEvent

    data class Finished(
        val text: String,
        val reasoning: String,
        val tokens: Int,
        val tokensPerSecond: Double,
        val prefillSeconds: Double,
        val cancelled: Boolean,
    ) : TextEvent

    data class Failed(val message: String, val fatal: Boolean) : TextEvent
}

interface TextEngine : Engine {
    override val modality get() = Modality.TEXT

    /** Streams one turn. Collect it to the end: [TextEvent.Finished] or [TextEvent.Failed]. */
    fun generate(request: TextRequest): Flow<TextEvent>

    /** Stops the current turn early; the model stays loaded. */
    fun cancel()
}

// ── speech ──

data class Transcript(val text: String, val language: String?)

interface SpeechToTextEngine : Engine {
    override val modality get() = Modality.SPEECH_TO_TEXT

    /** [audio] is 16 kHz mono PCM WAV. */
    suspend fun transcribe(audio: File, language: String? = null): Transcript
}

interface TextToSpeechEngine : Engine {
    override val modality get() = Modality.TEXT_TO_SPEECH

    /** Writes a WAV file and returns it. */
    suspend fun synthesize(text: String, voice: String? = null): File
}

// ── images ──

data class ImageRequest(
    val prompt: String,
    val negativePrompt: String = "",
    val width: Int = 512,
    val height: Int = 512,
    val steps: Int = 20,
    val seed: Long = -1,
)

sealed interface ImageEvent {
    data class Step(val step: Int, val steps: Int) : ImageEvent
    data class Finished(val image: File) : ImageEvent
    data class Failed(val message: String) : ImageEvent
}

interface ImageGenerationEngine : Engine {
    override val modality get() = Modality.IMAGE_GENERATION

    fun generate(request: ImageRequest): Flow<ImageEvent>
}
