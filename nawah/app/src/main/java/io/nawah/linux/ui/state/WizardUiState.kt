package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.core.model.Compatibility
import io.nawah.linux.core.model.CompatReport
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroSpec
import io.nawah.linux.core.model.MachinePermissions
import io.nawah.linux.core.model.ResourceProfile

/** One release of a distribution, together with this device's verdict on it. */
@Immutable
data class DistroOption(
    val spec: DistroSpec,
    val report: CompatReport,
) {
    val selectable: Boolean get() = spec.enabled && report.overall != Compatibility.BLOCKED
}

/**
 * A distribution and its releases, as the picker shows them.
 *
 * Two levels because one flat list of every distribution times every release is
 * a wall of near-identical rows, and nobody reads a wall. A person looks for a
 * name they recognise first, and only then cares which release.
 */
@Immutable
data class FamilyOption(
    val id: String,
    val name: String,
    val tagline: String,
    val versions: List<DistroOption>,
) {
    /** The worst-case badge for the family: what the best release can manage. */
    val bestVerdict: Compatibility
        get() = versions.minOfOrNull { it.report.overall } ?: Compatibility.BLOCKED

    val selectable: Boolean get() = versions.any { it.selectable }

    /** Newest LTS, else newest. The default a user accepts without reading. */
    val default: DistroOption?
        get() = versions.firstOrNull { it.selectable && it.spec.lts }
            ?: versions.firstOrNull { it.selectable }
}

/**
 * One entry of the display-size list, as a percentage of the phone's screen.
 *
 * A percentage and not a pixel size. Pixel sizes were tried and were wrong:
 * 1280x720 on a 19.5:9 phone is a 16:9 box with black bars on every side,
 * scaled up to the panel. A percentage keeps the aspect ratio right by
 * construction and always fills the screen; 100 is the panel's own resolution
 * and anything larger is a smaller, lighter X screen drawn at the same
 * physical size.
 */
@Immutable
data class ResolutionOption(val percent: Int) {
    val key: String get() = percent.toString()
}

/** Native, then three steps of "smaller and lighter, and easier to read". */
val DefaultResolutions: List<ResolutionOption> = listOf(
    ResolutionOption(100),
    ResolutionOption(125),
    ResolutionOption(150),
    ResolutionOption(200),
)

/** Why a name was rejected. Rendered through string resources by the screen. */
enum class NameError { EMPTY, TOO_LONG, DUPLICATE, ILLEGAL_CHARS }

@Immutable
data class WizardUiState(
    /** 1-based, 1..[TOTAL_STEPS]. */
    val step: Int = 1,
    val families: List<FamilyOption> = emptyList(),
    /** The family whose releases are open. Null until one is tapped. */
    val openFamilyId: String? = null,
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

    /** Every release of every family, flattened. */
    val distros: List<DistroOption> get() = families.flatMap { it.versions }

    val selectedDistro: DistroOption?
        get() = distros.firstOrNull { it.spec.id == selectedDistroId }

    /** The family the selected release belongs to, for the summary line. */
    val selectedFamily: FamilyOption?
        get() = families.firstOrNull { f -> f.versions.any { it.spec.id == selectedDistroId } }

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
