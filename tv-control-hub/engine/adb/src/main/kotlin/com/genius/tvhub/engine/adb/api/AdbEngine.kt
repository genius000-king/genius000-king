package com.genius.tvhub.engine.adb.api

import com.genius.tvhub.engine.adb.screen.H264Unit
import com.genius.tvhub.engine.adb.setup.StepId
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/**
 * ADB mode: TV Hub connects to the TV's own ADB (127.0.0.1:5555) and gains what a computer with
 * a cable would have, without root: real key and touch events, the screen without a capture
 * prompt, installs without prompts, and a one-time setup of everything else.
 */
interface AdbEngine {
    val state: StateFlow<AdbState>

    /** Connects (or reconnects). The first time, the TV asks "Allow USB debugging?". */
    fun connect()
    fun disconnect()

    /** Real input through the shell agent; ready once the agent answered. */
    val input: AgentInput

    /** The screen as H.264 via screenrecord. Cold; restarts screenrecord as its time limit ends. */
    fun screen(width: Int, height: Int, bitrate: Int): Flow<H264Unit>

    /** A key frame soon, for a viewer that lost one. */
    fun requestKeyFrame()

    /** Installs one app (base APK plus any splits) without asking anyone. Null on success, else the reason. */
    suspend fun install(apks: List<File>): String?

    /** One-time setup; returns the steps that failed (empty = everything applied). */
    suspend fun setup(takeHome: Boolean): List<StepId>

    suspend fun shell(command: String): ShellOutput
}

data class ShellOutput(val exitCode: Int, val output: String)

interface AgentInput {
    val ready: StateFlow<Boolean>
    suspend fun key(keyCode: Int, longPress: Boolean = false): Boolean
    suspend fun text(text: String): Boolean
    suspend fun tap(x: Float, y: Float, longPress: Boolean = false): Boolean
    suspend fun swipe(points: List<Pair<Float, Float>>, durationMillis: Long): Boolean
}

sealed interface AdbState {
    data object Off : AdbState
    data object Connecting : AdbState
    /** Waiting on the TV's "Allow USB debugging?" prompt. */
    data object AwaitingApproval : AdbState
    data object Ready : AdbState
    data class Unavailable(val reason: Reason) : AdbState

    enum class Reason {
        /** Nothing listens on port 5555: network ADB is off on this TV. */
        PORT_CLOSED,
        /** The prompt was declined or never answered. */
        NOT_APPROVED,
        FAILED,
    }
}
