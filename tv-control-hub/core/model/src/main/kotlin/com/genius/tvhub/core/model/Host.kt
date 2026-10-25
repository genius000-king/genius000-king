package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

enum class CheckState { OK, MISSING, UNSUPPORTED }

/** One line of the TV's setup checklist / diagnostics. */
@Serializable
data class CapabilityCheck(val id: Capability, val state: CheckState, val detail: String = "")

enum class Capability {
    ACCESSIBILITY,
    DPAD_ACTIONS,
    GESTURES,
    SCREEN_CAPTURE,
    VIDEO_ENCODER,
    INSTALL_PACKAGES,
    ALL_FILES,
    TERMUX,
    TERMUX_RUN_COMMAND,
    CPU_FREQ,
    CPU_LOAD,
    THERMAL,
}

@Serializable
data class HostStatus(
    val peer: PeerInfo,
    val checks: List<CapabilityCheck>,
    val grants: Grants,
    val streaming: Boolean,
)
