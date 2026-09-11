package io.nawah.linux.core.provision

import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroSpec
import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.model.MachinePermissions
import io.nawah.linux.core.model.ResourceProfile
import kotlinx.serialization.Serializable

/** The ordered stages of an install. Order is the contract the UI renders. */
@Serializable
enum class InstallStep(val order: Int, val label: String) {
    DOWNLOADING(1, "Downloading system image"),
    VERIFYING(2, "Verifying image"),
    EXTRACTING(3, "Unpacking filesystem"),
    BOOTSTRAPPING(4, "Configuring base system"),
    INSTALLING_PACKAGES(5, "Installing desktop packages"),
    INSTALLING_X11_BRIDGE(6, "Installing display bridge"),
    CONFIGURING(7, "Finishing up");

    companion object {
        val ordered: List<InstallStep> = entries.sortedBy { it.order }
    }
}

sealed interface InstallProgress {
    data class Running(
        val step: InstallStep,
        val fraction: Float? = null,
        val line: String? = null,
    ) : InstallProgress

    data class Done(val machine: Machine) : InstallProgress

    data class Failed(
        val step: InstallStep,
        val message: String,
        val log: String,
    ) : InstallProgress
}

/** Everything the pipeline needs, decided before the first byte is downloaded. */
@Serializable
data class InstallRequest(
    val machineId: String,
    val name: String,
    val distro: DistroSpec,
    val desktop: DesktopSpec,
    val profile: ResourceProfile,
    val permissions: MachinePermissions,
    val displayWidth: Int,
    val displayHeight: Int,
    val dnsServers: List<String> = listOf("1.1.1.1", "8.8.8.8"),
)

interface Provisioner {
    fun install(request: InstallRequest): kotlinx.coroutines.flow.Flow<InstallProgress>

    /**
     * Continues an install that was interrupted, from the last step it
     * finished. Null when there is no record to continue from.
     */
    fun resume(machineId: String): kotlinx.coroutines.flow.Flow<InstallProgress>?
    suspend fun remove(machineId: String)
    suspend fun repairX11Bridge(machineId: String)
}
