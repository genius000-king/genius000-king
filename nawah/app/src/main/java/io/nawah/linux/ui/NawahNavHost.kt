package io.nawah.linux.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.activity.compose.LocalActivity
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavHostController
import io.nawah.linux.BuildConfig
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
    const val SESSION = "session"
    const val APP_SETTINGS = "app-settings"
    const val ABOUT = "about"
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
                onRun = { vm.run(it); nav.navigate(Routes.SESSION) },
                onResume = { vm.resumeInstall(it); nav.navigate(Routes.INSTALL) },
                onSettings = { vm.openSettings(it); nav.navigate(Routes.settings(it)) },
                onRepair = { vm.repair(it) },
                onDelete = { vm.delete(it) },
                onDiagnostics = { vm.loadDiagnostics(); nav.navigate(Routes.DIAGNOSTICS) },
                onAppSettings = { vm.loadAppSettings(); nav.navigate(Routes.APP_SETTINGS) },
            )
        }

        composable(Routes.APP_SETTINGS) {
            val state by vm.settingsApp.collectAsStateWithLifecycle()
            val activity = LocalActivity.current
            AppSettingsScreen(
                state = state,
                onBack = { nav.popBackStack() },
                // The language reaches the screen through the Activity's base
                // context, which is built once in attachBaseContext -- so the
                // Activity has to be recreated for a change to appear at all.
                onLanguage = { if (vm.setLanguage(it)) activity?.recreate() },
                onKeepScreenOn = vm::setKeepScreenOn,
                onOpenDisplayOnRun = vm::setOpenDisplayOnRun,
                onDiagnostics = { vm.loadDiagnostics(); nav.navigate(Routes.DIAGNOSTICS) },
                onAbout = { nav.navigate(Routes.ABOUT) },
            )
        }

        composable(Routes.ABOUT) {
            AboutScreen(
                versionName = BuildConfig.VERSION_NAME,
                sourceUrl = SOURCE_URL,
                onBack = { nav.popBackStack() },
                onOpenUrl = context::openUrl,
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
                    onFamily = vm::openFamily,
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

        composable(Routes.SESSION) {
            val session by vm.sessionLog.collectAsStateWithLifecycle()
            SessionLogScreen(
                machineName = session.first,
                lines = session.second,
                running = session.third,
                onBack = { nav.popBackStack() },
                onCopy = { context.copyToClipboard(session.second.joinToString("\n")) },
                onOpenDisplay = vm::openDisplay,
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
                onCopyCrash = { state.lastCrash?.let(context::copyToClipboard) },
                onClearCrash = vm::clearCrash,
            )
        }
    }
}

/** Where the source lives. Shown in About, and the licence requires it. */
private const val SOURCE_URL = "https://github.com/genius000-king/nawah"

private fun Context.openUrl(url: String) {
    runCatching {
        startActivity(
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}

private fun Context.copyToClipboard(text: String) {
    getSystemService(ClipboardManager::class.java)
        .setPrimaryClip(ClipData.newPlainText("nawah-log", text))
}
