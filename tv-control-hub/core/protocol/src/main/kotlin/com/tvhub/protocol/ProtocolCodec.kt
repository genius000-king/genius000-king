package com.tvhub.protocol

import com.tvhub.common.AppError
import com.tvhub.common.AppResult
import com.tvhub.common.flatMap
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Wire format for [ProtocolMessage].
 *
 * Policy:
 * - Unknown fields are ignored, so a newer peer can add optional fields.
 * - Unknown message types decode to [UnknownMessage], which receivers drop.
 * - An unknown enum value inside a known message is malformed. New enum values
 *   require a protocol version bump, so they are never guessed.
 */
object ProtocolCodec {

    const val ERROR_MALFORMED = "protocol.malformed"
    const val ERROR_MISSING_TYPE = "protocol.missing_type"

    internal const val TYPE_FIELD = "type"

    /** Must list every @SerialName used by [ProtocolMessage]. A test enforces this. */
    internal val KNOWN_MESSAGE_TYPES: Set<String> = setOf(
        "hello",
        "hello_ack",
        "reject",
        "ping",
        "pong",
        "sdp_offer",
        "sdp_answer",
        "ice_candidate",
        "tap",
        "global_action",
    )

    private val json = Json {
        classDiscriminator = TYPE_FIELD
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    /** Decodes a message, or returns null when it is malformed or of an unknown type. */
    fun decodeOrNull(text: String): ProtocolMessage? =
        (decode(text) as? AppResult.Success)?.value?.takeUnless { it is UnknownMessage }

    fun encode(message: ProtocolMessage): String =
        json.encodeToString(ProtocolMessage.serializer(), message)

    fun decode(text: String): AppResult<ProtocolMessage> =
        parseObject(text).flatMap { fields ->
            readType(fields).flatMap<String, ProtocolMessage> { type ->
                if (type in KNOWN_MESSAGE_TYPES) decodeKnown(type, fields)
                else AppResult.Success(UnknownMessage(type))
            }
        }

    private fun parseObject(text: String): AppResult<JsonObject> =
        runCatching { json.parseToJsonElement(text) }.fold(
            onSuccess = { element ->
                (element as? JsonObject)?.let { AppResult.Success(it) }
                    ?: AppResult.Failure(AppError(ERROR_MALFORMED, "Message must be a JSON object"))
            },
            onFailure = { AppResult.Failure(AppError(ERROR_MALFORMED, "Message is not valid JSON", it)) },
        )

    private fun readType(fields: JsonObject): AppResult<String> {
        val type = (fields[TYPE_FIELD] as? JsonPrimitive)?.takeIf { it.isString }?.content
        return if (type != null) {
            AppResult.Success(type)
        } else {
            AppResult.Failure(AppError(ERROR_MISSING_TYPE, "Message has no string '$TYPE_FIELD' field"))
        }
    }

    private fun decodeKnown(type: String, fields: JsonObject): AppResult<ProtocolMessage> =
        runCatching { json.decodeFromJsonElement(ProtocolMessage.serializer(), fields) }.fold(
            onSuccess = { AppResult.Success(it) },
            onFailure = { AppResult.Failure(AppError(ERROR_MALFORMED, "Invalid '$type' message", it)) },
        )
}
