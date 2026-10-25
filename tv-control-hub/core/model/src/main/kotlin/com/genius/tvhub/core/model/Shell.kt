package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

enum class ShellBackend { SANDBOX, TERMUX }

@Serializable
data class CommandResult(val exitCode: Int, val stdout: String, val stderr: String, val durationMillis: Long, val truncated: Boolean)

enum class ServiceKind { NODE, PYTHON, CUSTOM }

enum class ServiceState { RUNNING, STOPPED, CRASHED, UNKNOWN }

/** A long-running program the TV keeps alive in Termux: a Node or Python server, a bot. */
@Serializable
data class ServiceSpec(
    val id: String,
    val name: String,
    val kind: ServiceKind,
    val workdir: String,
    val command: String,
    val autoStart: Boolean = false,
)

@Serializable
data class ServiceStatus(val id: String, val state: ServiceState, val pid: Int? = null, val uptimeSeconds: Long? = null)
