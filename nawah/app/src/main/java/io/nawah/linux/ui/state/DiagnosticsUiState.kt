package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable

/** Everything `DeviceProbe`'s cheap, synchronous calls report. */
@Immutable
data class DeviceFacts(
    val abi: String = "",
    val totalRamBytes: Long = 0L,
    val availableStorageBytes: Long = 0L,
    val cpuCores: Int = 0,
    val apiLevel: Int = 0,
)

/**
 * The live `DeviceProbe.runProotProbe()` result. [UNKNOWN] means it has not
 * been run yet — which is a different thing from having run and failed, and
 * the screen says so.
 */
enum class ProbeStatus { UNKNOWN, RUNNING, PASSED, FAILED }

@Immutable
data class DiagnosticsUiState(
    val facts: DeviceFacts = DeviceFacts(),
    val probe: ProbeStatus = ProbeStatus.UNKNOWN,
    /** Optional one-line detail from the probe, e.g. an errno or a kernel message. */
    val probeDetail: String? = null,
    val exporting: Boolean = false,
)
