package com.genius.tvhub.engine.input.api

import kotlinx.coroutines.flow.StateFlow

/**
 * Real input events (key codes, touches, text) injected below the app layer — ADB mode on the TV.
 * The input engine prefers it when [ready]; the host wires an implementation in, so this engine
 * never depends on another engine. Points are normalized (0..1 of the screen), like [com.genius.tvhub.core.model.NormPoint].
 */
interface RawInput {
    val ready: StateFlow<Boolean>
    suspend fun key(keyCode: Int, longPress: Boolean = false): Boolean
    suspend fun text(text: String): Boolean
    suspend fun tap(x: Float, y: Float, longPress: Boolean = false): Boolean
    suspend fun swipe(points: List<Pair<Float, Float>>, durationMillis: Long): Boolean
}
