package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.core.model.Machine

/**
 * A [Machine] plus the two display names it does not carry itself: the core
 * model stores `distroId` / `desktopId`, and resolving those against the
 * catalogue is the caller's job, not the view's.
 */
@Immutable
data class MachineListItem(
    val machine: Machine,
    val distroName: String,
    val desktopName: String,
    /** Bytes the machine occupies on disk; -1 when not measured yet. */
    val diskUsageBytes: Long = -1L,
    /** A failed install that recorded how far it got can be continued. */
    val resumable: Boolean = false,
) {
    val id: String get() = machine.id
    val name: String get() = machine.name
    val state get() = machine.state
}

@Immutable
data class HomeUiState(
    val machines: List<MachineListItem> = emptyList(),
    val loading: Boolean = false,
) {
    val isEmpty: Boolean get() = !loading && machines.isEmpty()
}
