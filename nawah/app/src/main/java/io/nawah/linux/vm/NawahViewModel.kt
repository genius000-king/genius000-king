package io.nawah.linux.vm

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.nawah.linux.CrashLog
import io.nawah.linux.NawahApplication
import io.nawah.linux.core.model.*
import io.nawah.linux.core.probe.ProbeResult
import io.nawah.linux.core.provision.InstallCheckpoint
import io.nawah.linux.core.provision.InstallRequest
import io.nawah.linux.core.provision.InstallStep
import io.nawah.linux.service.InstallService
import io.nawah.linux.service.SessionService
import io.nawah.linux.ui.state.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * One view model for the whole app.
 *
 * The screens are stateless and take plain data, so there is no per-screen
 * state to isolate; splitting this into five classes would mostly duplicate
 * the same three dependencies. If a screen grows its own lifecycle, that is
 * the moment to split -- not before.
 */
class NawahViewModel(app: Application) : AndroidViewModel(app) {

    private val services = (app as NawahApplication).services

    // -- home ---------------------------------------------------------------

    private val diskUsage = MutableStateFlow<Map<String, Long>>(emptyMap())

    val home: StateFlow<HomeUiState> =
        combine(services.machineStore.machines, diskUsage) { machines, usage ->
            HomeUiState(
                machines = machines.map { m ->
                    MachineListItem(
                        machine = m,
                        distroName = services.catalog.distro(m.distroId)?.name ?: m.distroId,
                        desktopName = services.catalog.desktop(m.desktopId)?.name ?: m.desktopId,
                        diskUsageBytes = usage[m.id] ?: -1L,
                        resumable = m.state == MachineState.FAILED &&
                            InstallCheckpoint.load(services.machineStore.machineDir(m.id)) != null,
                    )
                },
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState(loading = true))

    fun refreshDiskUsage() = viewModelScope.launch(Dispatchers.IO) {
        val sizes = services.machineStore.machines.value.associate {
            it.id to services.machineStore.machineDir(it.id).sizeOnDisk()
        }
        diskUsage.value = sizes
    }

    // -- session ------------------------------------------------------------

    private val _sessionMachine = MutableStateFlow<String?>(null)

    /** Name, log tail and whether the container is still up. */
    val sessionLog: StateFlow<Triple<String, List<String>, Boolean>> =
        combine(
            _sessionMachine,
            SessionService.lastLog,
            SessionService.running,
        ) { id, lines, runningId ->
            val name = id?.let { services.machineStore.get(it)?.name }.orEmpty()
            Triple(name, lines, runningId != null && runningId == id)
        }.stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            Triple("", emptyList(), false),
        )

    fun run(machineId: String) {
        _sessionMachine.value = machineId
        SessionService.start(getApplication(), machineId)
    }

    fun openSessionLog(machineId: String) {
        _sessionMachine.value = machineId
    }

    /** Brings the X display forward without restarting anything. */
    fun openDisplay() = services.sessionLauncher.openDisplay()

    /** Session output already written to disk, for a machine that has stopped. */
    fun storedSessionLog(machineId: String): List<String> =
        services.machineStore.sessionLogFile(machineId)
            .takeIf { it.isFile }
            ?.runCatching { readLines() }?.getOrNull()
            .orEmpty()

    /** Continues an interrupted install instead of starting it over. */
    fun resumeInstall(machineId: String) {
        val machine = services.machineStore.get(machineId) ?: return
        _install.value = InstallUiState(
            machineName = machine.name,
            steps = InstallStep.ordered.map { it.toUi() },
        )
        InstallService.resume(getApplication(), machineId)
    }

    fun delete(machineId: String) = viewModelScope.launch {
        services.provisioner.remove(machineId)
    }

    fun repair(machineId: String) = viewModelScope.launch {
        _settings.update { it.copy(repairing = true) }
        runCatching { services.provisioner.repairX11Bridge(machineId) }
        _settings.update { it.copy(repairing = false) }
    }

    // -- wizard -------------------------------------------------------------

    private val _wizard = MutableStateFlow(WizardUiState())
    val wizard: StateFlow<WizardUiState> = _wizard.asStateFlow()

    fun startWizard() {
        val facts = services.deviceProbe.facts()
        val distros = services.catalog.distros.map { spec ->
            DistroOption(spec, services.deviceProbe.report(spec, services.catalog.desktops.firstOrNull()))
        }
        _wizard.value = WizardUiState(
            distros = distros,
            desktops = services.catalog.desktops,
            selectedDistroId = distros.firstOrNull { it.selectable }?.spec?.id,
            availableStorageBytes = facts.availableStorageBytes,
            machineName = defaultName(),
        )
    }

    fun wizardBack() = _wizard.update { it.copy(step = (it.step - 1).coerceAtLeast(1)) }
    fun wizardNext() = _wizard.update { it.copy(step = (it.step + 1).coerceAtMost(it.totalSteps)) }
    fun selectDistro(id: String) = _wizard.update { it.copy(selectedDistroId = id) }
    fun selectDesktop(id: String) = _wizard.update { it.copy(selectedDesktopId = id) }
    fun selectProfile(p: ResourceProfile) = _wizard.update { it.copy(profile = p) }
    fun selectResolution(r: ResolutionOption) = _wizard.update { it.copy(selectedResolution = r) }
    fun setPermissions(p: MachinePermissions) = _wizard.update { it.copy(permissions = p) }

    fun setName(name: String) = _wizard.update { it.copy(name = name) }

    private fun WizardUiState.copy(name: String) =
        copy(machineName = name, nameError = validateName(name, null))

    /** Returns the id of the machine being installed. */
    fun submitWizard(): String? {
        val s = _wizard.value
        val distro = s.selectedDistro?.spec ?: return null
        val desktop = s.selectedDesktop ?: return null
        val id = UUID.randomUUID().toString()
        val request = InstallRequest(
            machineId = id,
            name = s.machineName.trim(),
            distro = distro,
            desktop = desktop,
            profile = s.profile,
            permissions = s.permissions,
            displayWidth = s.selectedResolution.width,
            displayHeight = s.selectedResolution.height,
        )
        _install.value = InstallUiState(
            machineName = request.name,
            steps = InstallStep.ordered.map { it.toUi() },
        )
        InstallService.start(getApplication(), request)
        return id
    }

    // -- install ------------------------------------------------------------

    private val _install = MutableStateFlow(InstallUiState())
    val install: StateFlow<InstallUiState> = _install.asStateFlow()

    init {
        viewModelScope.launch {
            InstallService.current.filterNotNull().collect { progress ->
                _install.update { it.reduce(progress) }
            }
        }
    }

    fun cancelInstall() {
        _install.update { it.copy(cancelling = true) }
        InstallService.cancel(getApplication())
    }

    // -- machine settings ---------------------------------------------------

    private val _settings = MutableStateFlow(MachineSettingsUiState())
    val settings: StateFlow<MachineSettingsUiState> = _settings.asStateFlow()

    fun openSettings(machineId: String) {
        val m = services.machineStore.get(machineId) ?: return
        _settings.value = MachineSettingsUiState(
            machineId = m.id,
            name = m.name,
            distroName = services.catalog.distro(m.distroId)?.name ?: m.distroId,
            desktopName = services.catalog.desktop(m.desktopId)?.name ?: m.desktopId,
            state = m.state,
            permissions = m.permissions,
            selectedResolution = DefaultResolutions
                .firstOrNull { it.width == m.displayWidth && it.height == m.displayHeight }
                ?: DefaultResolutions.first(),
        )
        viewModelScope.launch(Dispatchers.IO) {
            val size = services.machineStore.machineDir(machineId).sizeOnDisk()
            _settings.update { if (it.machineId == machineId) it.copy(diskUsageBytes = size) else it }
        }
    }

    fun settingsName(name: String) = _settings.update {
        it.copy(name = name, nameError = validateName(name, it.machineId))
    }

    fun saveSettings() = viewModelScope.launch {
        val s = _settings.value
        val m = services.machineStore.get(s.machineId) ?: return@launch
        services.machineStore.put(
            m.copy(
                name = s.name.trim(),
                permissions = s.permissions,
                displayWidth = s.selectedResolution.width,
                displayHeight = s.selectedResolution.height,
            ),
        )
    }

    fun settingsPermissions(p: MachinePermissions) {
        _settings.update { it.copy(permissions = p) }
        saveSettings()
    }

    fun settingsResolution(r: ResolutionOption) {
        _settings.update { it.copy(selectedResolution = r) }
        saveSettings()
    }

    fun requestDelete() = _settings.update { it.copy(showDeleteDialog = true) }
    fun dismissDelete() = _settings.update { it.copy(showDeleteDialog = false) }

    // -- diagnostics --------------------------------------------------------

    private val _diagnostics = MutableStateFlow(DiagnosticsUiState())
    val diagnostics: StateFlow<DiagnosticsUiState> = _diagnostics.asStateFlow()

    fun loadDiagnostics() {
        val f = services.deviceProbe.facts()
        _diagnostics.update {
            it.copy(
                facts = DeviceFacts(
                    abi = f.abi,
                    totalRamBytes = f.totalRamBytes,
                    availableStorageBytes = f.availableStorageBytes,
                    cpuCores = f.cpuCores,
                    apiLevel = f.apiLevel,
                ),
                lastCrash = CrashLog.read(getApplication()),
            )
        }
    }

    fun clearCrash() {
        CrashLog.clear(getApplication())
        _diagnostics.update { it.copy(lastCrash = null) }
    }

    fun runProbe() = viewModelScope.launch {
        _diagnostics.update { it.copy(probe = ProbeStatus.RUNNING, probeDetail = null) }
        when (val r = services.deviceProbe.runProotProbe()) {
            is ProbeResult.Passed ->
                _diagnostics.update { it.copy(probe = ProbeStatus.PASSED, probeDetail = null) }
            is ProbeResult.Failed ->
                _diagnostics.update { it.copy(probe = ProbeStatus.FAILED, probeDetail = r.reason) }
        }
    }

    /** Writes a support bundle and returns the file, or null when it could not be produced. */
    suspend fun exportDiagnostics(): File? = withContext(Dispatchers.IO) {
        _diagnostics.update { it.copy(exporting = true) }
        try {
            val out = File(getApplication<Application>().cacheDir, "nawah-diagnostics.txt")
            val f = services.deviceProbe.facts()
            out.writeText(
                buildString {
                    appendLine("abi=${f.abi} api=${f.apiLevel} cores=${f.cpuCores}")
                    appendLine("ram=${f.totalRamBytes} free=${f.availableStorageBytes}")
                    appendLine("nativeTools missing=${services.nativeTools.missingTools()}")
                    appendLine("probe=${_diagnostics.value.probe} ${_diagnostics.value.probeDetail.orEmpty()}")
                    appendLine()
                    CrashLog.read(getApplication())?.let {
                        appendLine("--- last crash")
                        appendLine(it)
                        appendLine()
                    }
                    services.machineStore.machines.value.forEach { m ->
                        appendLine("--- ${m.name} (${m.id}) ${m.state} ${m.distroId}/${m.desktopId}")
                        val log = services.machineStore.logFile(m.id)
                        if (log.isFile) appendLine(log.readText().takeLast(20_000))
                    }
                },
            )
            out
        } catch (_: Exception) {
            null
        } finally {
            _diagnostics.update { it.copy(exporting = false) }
        }
    }

    // -- helpers ------------------------------------------------------------

    private fun validateName(name: String, selfId: String?): NameError? {
        val trimmed = name.trim()
        return when {
            trimmed.isEmpty() -> NameError.EMPTY
            trimmed.length > 32 -> NameError.TOO_LONG
            trimmed.any { it == '/' || it == '\\' || it.code < 0x20 } -> NameError.ILLEGAL_CHARS
            services.machineStore.machines.value
                .any { it.name.equals(trimmed, true) && it.id != selfId } -> NameError.DUPLICATE
            else -> null
        }
    }

    private fun defaultName(): String {
        val used = services.machineStore.machines.value.map { it.name }.toSet()
        return generateSequence(1) { it + 1 }
            .map { if (it == 1) "Linux" else "Linux $it" }
            .first { it !in used }
    }
}

/** Directory size without following symlinks -- a rootfs is full of them. */
private fun File.sizeOnDisk(): Long {
    if (!isDirectory || java.nio.file.Files.isSymbolicLink(toPath())) return length()
    return listFiles()?.sumOf { it.sizeOnDisk() } ?: 0L
}
