package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.core.model.Compatibility
import io.nawah.linux.core.model.CompatReport
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroSpec
import io.nawah.linux.core.model.MachinePermissions
import io.nawah.linux.core.model.ResourceProfile
import io.nawah.linux.ui.util.formatResolution

/** A distribution together with this device's verdict on it. */
@Immutable
data class DistroOption(
    val spec: DistroSpec,
    val report: CompatReport,
) {
    val selectable: Boolean get() = spec.enabled && report.overall != Compatibility.BLOCKED
}

/** One entry of the display-resolution dropdown. */
@Immutable
data class ResolutionOption(val width: Int, val height: Int) {
    val label: String get() = formatResolution(width, height)
    val key: String get() = "${width}x$height"
}

/**
 * The resolutions offered. Deliberately short: these are the sizes the X11
 * bridge is known to drive without tearing, and a free-form field would only
 * invite a value the compositor cannot handle.
 */
val DefaultResolutions: List<ResolutionOption> = listOf(
    ResolutionOption(1280, 720),
    ResolutionOption(1600, 900),
    ResolutionOption(1920, 1080),
    ResolutionOption(2560, 1440),
)

/** Why a name was rejected. Rendered through string resources by the screen. */
enum class NameError { EMPTY, TOO_LONG, DUPLICATE, ILLEGAL_CHARS }

@Immutable
data class WizardUiState(
    /** 1-based, 1..[TOTAL_STEPS]. */
    val step: Int = 1,
    val distros: List<DistroOption> = emptyList(),
    val selectedDistroId: String? = null,
    val desktops: List<DesktopSpec> = emptyList(),
    val selectedDesktopId: String? = null,
    val machineName: String = "",
    val nameError: NameError? = null,
    val profile: ResourceProfile = ResourceProfile.BALANCED,
    val resolutions: List<ResolutionOption> = DefaultResolutions,
    val selectedResolution: ResolutionOption = DefaultResolutions[0],
    val permissions: MachinePermissions = MachinePermissions(),
    /** Free space reported by `DeviceProbe.availableStorageBytes()`. */
    val availableStorageBytes: Long = 0L,
    val submitting: Boolean = false,
) {
    val totalSteps: Int get() = TOTAL_STEPS

    val selectedDistro: DistroOption?
        get() = distros.firstOrNull { it.spec.id == selectedDistroId }

    val selectedDesktop: DesktopSpec?
        get() = desktops.firstOrNull { it.id == selectedDesktopId }

    /** Base rootfs + desktop packages. An estimate, and labelled as one in the UI. */
    val estimatedInstalledBytes: Long
        get() = (selectedDistro?.spec?.installedBytes ?: 0L) +
            (selectedDesktop?.installedBytes ?: 0L)

    val estimatedDownloadBytes: Long
        get() = selectedDistro?.spec?.downloadBytes ?: 0L

    /**
     * A warning threshold, never an enforced quota: we ask for a comfortable
     * 20% margin over the estimate before calling the install roomy.
     */
    val storageIsTight: Boolean
        get() = availableStorageBytes > 0 &&
            availableStorageBytes < (estimatedInstalledBytes * 12) / 10

    val storageIsInsufficient: Boolean
        get() = availableStorageBytes in 1 until estimatedInstalledBytes

    val canGoBack: Boolean get() = step > 1 && !submitting

    val canGoNext: Boolean
        get() = !submitting && when (step) {
            1 -> selectedDistro?.selectable == true
            2 -> selectedDesktop != null
            3 -> machineName.isNotBlank() && nameError == null
            else -> true
        }

    val isLastStep: Boolean get() = step == TOTAL_STEPS

    companion object {
        const val TOTAL_STEPS: Int = 4
    }
}
