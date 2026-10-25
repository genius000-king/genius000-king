package com.genius.tvhub.core.protocol

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.cbor.Cbor
import kotlinx.serialization.decodeFromByteArray
import kotlinx.serialization.encodeToByteArray

/** CBOR: binary, compact, and file chunks travel as raw bytes rather than base64. */
@OptIn(ExperimentalSerializationApi::class)
object ProtocolCodec {
    val cbor = Cbor {
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

    fun encode(frame: Frame): ByteArray = cbor.encodeToByteArray(frame)
    fun decode(bytes: ByteArray): Frame = cbor.decodeFromByteArray(bytes)
}
