package io.nawah.linux.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavHostController
import io.nawah.linux.ui.screens.*
import io.nawah.linux.vm.NawahViewModel
import kotlinx.coroutines.launch
import java.io.File

private object Routes {
    const val HOME = "home"
    const val WIZARD = "wizard"
    const val INSTALL = "install"
    const val SETTINGS = "settings/{id}"
    const val DIAGNOSTICS = "diagnostics"
    fun settings(id: String) = "settings/$id"
}

@Composable
fun NawahNavHost(
    vm: NawahViewModel,
    onShare: (File) -> Unit,
    nav: NavHostController = rememberNavController(),
) {
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    NavHost(nav, startDestination = Routes.HOME) {

        composable(Routes.HOME) {
            val state by vm.home.collectAsStateWithLifecycle()
            LaunchedEffect(Unit) { vm.refreshDiskUsage() }
            HomeScreen(
                state = state,
                onCreate = { vm.startWizard(); nav.navigate(Routes.WIZARD) },
                onRun = vm::run,
                onResume = { vm.resumeInstall(it); nav.navigate(Routes.INSTALL) },
                onSettings = { vm.openSettings(it); nav.navigate(Routes.settings(it)) },
                onRepair = { vm.repair(it) },
                onDelete = { vm.delete(it) },
                onDiagnostics = { vm.loadDiagnostics(); nav.navigate(Routes.DIAGNOSTICS) },
            )
        }

        composable(Routes.WIZARD) {
            val state by vm.wizard.collectAsStateWithLifecycle()
            WizardScreen(
                state = state,
                actions = WizardActions(
                    onBack = vm::wizardBack,
                    onNext = vm::wizardNext,
                    onCancel = { nav.popBackStack(Routes.HOME, false) },
                    onDistro = vm::selectDistro,
                    onDesktop = vm::selectDesktop,
                    onName = vm::setName,
                    onProfile = vm::selectProfile,
                    onResolution = vm::selectResolution,
                    onPermissions = vm::setPermissions,
                    onInstall = {
                        if (vm.submitWizard() != null) {
                            nav.navigate(Routes.INSTALL) {
                                popUpTo(Routes.HOME) { inclusive = false }
                            }
                        }
                    },
                ),
            )
        }

        composable(Routes.INSTALL) {
            val state by vm.install.collectAsStateWithLifecycle()
            InstallScreen(
                state = state,
                onCancel = vm::cancelInstall,
                onCopyLog = { context.copyToClipboard(state.logText) },
                onDone = { nav.popBackStack(Routes.HOME, false) },
            )
        }

        composable(Routes.SETTINGS) {
            val state by vm.settings.collectAsStateWithLifecycle()
            MachineSettingsScreen(
                state = state,
                actions = MachineSettingsActions(
                    onBack = { nav.popBackStack() },
                    onName = vm::settingsName,
                    onSaveName = { vm.saveSettings() },
                    onPermissions = vm::settingsPermissions,
                    onResolution = vm::settingsResolution,
                    onRepair = { vm.repair(state.machineId) },
                    onRequestDelete = vm::requestDelete,
                    onConfirmDelete = {
                        vm.dismissDelete()
                        vm.delete(state.machineId)
                        nav.popBackStack(Routes.HOME, false)
                    },
                    onDismissDelete = vm::dismissDelete,
                ),
            )
        }

        composable(Routes.DIAGNOSTICS) {
            val state by vm.diagnostics.collectAsStateWithLifecycle()
            DiagnosticsScreen(
                state = state,
                onBack = { nav.popBackStack() },
                onRunProbe = { vm.runProbe() },
                onExport = {
                    scope.launch { vm.exportDiagnostics()?.let(onShare) }
                },
            )
        }
    }
}

private fun Context.copyToClipboard(text: String) {
    getSystemService(ClipboardManager::class.java)
        .setPrimaryClip(ClipData.newPlainText("nawah-log", text))
}
