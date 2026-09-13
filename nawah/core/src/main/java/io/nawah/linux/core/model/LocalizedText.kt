package io.nawah.linux.core.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * A piece of catalog text in every language we have it in.
 *
 * The catalog is data in `assets/`, not string resources, so anything in it
 * that a user reads has no translation path — and "Command line only" sitting
 * untranslated in the middle of an Arabic screen is exactly the kind of half
 * translation that makes an app feel unfinished.
 *
 * Written in JSON either way round:
 *
 *     "name": "Debian"
 *     "name": { "en": "Command line only", "ar": "سطر الأوامر فقط" }
 *
 * The first form is not a legacy shim — a proper noun genuinely has one
 * spelling, and forcing `{"en": "Debian"}` on every row would be noise.
 */
@Serializable(with = LocalizedTextSerializer::class)
data class LocalizedText(val values: Map<String, String>) {

    /**
     * Text for [language] (an ISO 639 code such as `ar`), falling back to
     * English and then to whatever exists.
     *
     * Never throws and never returns null: a missing translation must show the
     * English word, not an empty row.
     */
    fun resolve(language: String): String =
        values[language] ?: values[FALLBACK] ?: values.values.firstOrNull().orEmpty()

    override fun toString(): String = resolve(FALLBACK)

    companion object {
        const val FALLBACK: String = "en"

        fun of(text: String): LocalizedText = LocalizedText(mapOf(FALLBACK to text))
    }
}

internal object LocalizedTextSerializer : KSerializer<LocalizedText> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("LocalizedText")

    override fun deserialize(decoder: Decoder): LocalizedText {
        val input = decoder as? JsonDecoder ?: return LocalizedText.of(decoder.decodeString())
        return when (val element = input.decodeJsonElement()) {
            is JsonPrimitive -> LocalizedText.of(element.content)
            is JsonObject -> LocalizedText(
                element.jsonObject.mapValues { (_, v) -> v.jsonPrimitive.content },
            )
            else -> LocalizedText.of("")
        }
    }

    override fun serialize(encoder: Encoder, value: LocalizedText) {
        val output = encoder as? JsonEncoder
        if (output == null || value.values.size == 1) {
            encoder.encodeString(value.resolve(LocalizedText.FALLBACK))
            return
        }
        output.encodeJsonElement(
            JsonObject(value.values.mapValues { (_, v) -> JsonPrimitive(v) }),
        )
    }
}
