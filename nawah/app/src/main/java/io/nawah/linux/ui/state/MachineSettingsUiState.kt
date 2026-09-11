package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.core.model.MachinePermissions
import io.nawah.linux.core.model.MachineState

@Immutable
data class MachineSettingsUiState(
    val machineId: String = "",
    val name: String = "",
    val nameError: NameError? = null,
    val distroName: String = "",
    val desktopName: String = "",
    val state: MachineState = MachineState.READY,
    val permissions: MachinePermissions = MachinePermissions(),
    val resolutions: List<ResolutionOption> = DefaultResolutions,
    val selectedResolution: ResolutionOption = DefaultResolutions[0],
    /** Bytes under machines/<id>/; -1 while it is still being measured. */
    val diskUsageBytes: Long = -1L,
    /** True while a repair or a delete is in flight; the screen locks down. */
    val busy: Boolean = false,
    val repairing: Boolean = false,
    val showDeleteDialog: Boolean = false,
) {
    val canSaveName: Boolean get() = name.isNotBlank() && nameError == null && !busy
}
