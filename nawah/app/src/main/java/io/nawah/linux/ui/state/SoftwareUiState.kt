package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.core.model.AppSpec

@Immutable
data class SoftwareUiState(
    val machineId: String = "",
    val machineName: String = "",
    val apps: List<AppSpec> = emptyList(),
    /** Already on the machine; shown as done rather than offered again. */
    val installedIds: Set<String> = emptySet(),
    val selectedIds: Set<String> = emptySet(),
)
