package com.genius.tvhub

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.tvhub.core.designsystem.GlassDialog
import com.genius.tvhub.core.designsystem.GlassField
import com.genius.tvhub.core.designsystem.PillButton
import com.genius.tvhub.feature.tv.launcher.AddSource
import com.genius.tvhub.feature.tv.launcher.LauncherActions
import com.genius.tvhub.feature.tv.launcher.LauncherScreen
import com.genius.tvhub.feature.tv.launcher.LauncherViewModel
import com.genius.tvhub.feature.tv.system.SystemScreen
import com.genius.tvhub.feature.tv.system.SystemViewModel
import kotlinx.coroutines.delay

/** The TV: the launcher is home; settings slide in over it and Back returns. */
@Composable
fun TvRoot() {
    var inSettings by rememberSaveable { mutableStateOf(false) }
    var askLink by rememberSaveable { mutableStateOf(false) }
    var now by androidx.compose.runtime.remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(10_000) } }

    AnimatedContent(inSettings, transitionSpec = { (fadeIn(tween(220)) + scaleIn(initialScale = 0.98f)) togetherWith fadeOut(tween(160)) }, label = "tv") { settings ->
        if (settings) {
            val vm: SystemViewModel = hiltViewModel()
            val state by vm.state.collectAsStateWithLifecycle()
            SystemScreen(state, vm)
        } else {
            val vm: LauncherViewModel = hiltViewModel()
            val state by vm.state.collectAsStateWithLifecycle()
            val actions = object : LauncherActions by vm {
                override fun openSettings() { inSettings = true }
                override fun addApp(source: AddSource) { if (source == AddSource.LINK) askLink = true else vm.addApp(source) }
            }
            LauncherScreen(state, actions, now)
            LocalApksSheet(vm)
            if (askLink) LinkDialog(onClose = { askLink = false }) { url -> askLink = false; vm.installFromLink(url) }
        }
    }
    // A home screen never exits on Back.
    BackHandler(true) { if (inSettings) inSettings = false }
    PairingOverlay()
}

/**
 * The pairing prompt inside the launcher too: if Android blocks starting the prompt activity from
 * the background (before accessibility is on), the person at the home screen still sees it.
 */
@Composable
private fun PairingOverlay() {
    val vm: com.genius.tvhub.feature.tv.system.PairingViewModel = hiltViewModel()
    val request by vm.request.collectAsStateWithLifecycle()
    request?.let { r -> com.genius.tvhub.feature.tv.system.PairingPrompt(r.peer.name, r.code, vm::allow, vm::deny) }
}

/** APK files found on USB or in Downloads; one press installs. */
@Composable
private fun LocalApksSheet(vm: LauncherViewModel) {
    val apks by vm.localApks.collectAsStateWithLifecycle()
    apks?.let { list ->
        com.genius.tvhub.core.designsystem.GlassSheet(androidx.compose.ui.res.stringResource(com.genius.tvhub.feature.tv.launcher.R.string.tv_add_from_files), vm::closeLocalApks) {
            if (list.isEmpty()) androidx.compose.material3.Text("—", color = com.genius.tvhub.core.designsystem.Imlaq.colors.muted)
            list.take(12).forEach { apk ->
                com.genius.tvhub.core.designsystem.MenuRow("${apk.file.name} · ${com.genius.tvhub.core.common.formatBytes(apk.sizeBytes)}", com.genius.tvhub.core.designsystem.HubIcons.Package, { vm.installLocal(apk) })
            }
        }
    }
}

/** A link typed with the phone's keyboard (it opens by itself) or the TV's. */
@Composable
private fun LinkDialog(onClose: () -> Unit, onInstall: (String) -> Unit) {
    var url by rememberSaveable { mutableStateOf("https://") }
    GlassDialog(androidx.compose.ui.res.stringResource(com.genius.tvhub.feature.tv.launcher.R.string.tv_add_from_link), onClose, actions = {
        PillButton(androidx.compose.ui.res.stringResource(com.genius.tvhub.feature.tv.launcher.R.string.tv_add_app), { onInstall(url) }, small = true)
    }) {
        GlassField(url, { url = it }, "https://…")
    }
}
