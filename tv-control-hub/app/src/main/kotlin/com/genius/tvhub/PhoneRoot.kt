package com.genius.tvhub

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.genius.tvhub.feature.phone.apps.AppsRoute
import com.genius.tvhub.feature.phone.device.DeviceRoute
import com.genius.tvhub.feature.phone.files.FilesRoute
import com.genius.tvhub.feature.phone.remote.Destination
import com.genius.tvhub.feature.phone.remote.MouseRoute
import com.genius.tvhub.feature.phone.remote.RemoteRoute
import com.genius.tvhub.feature.phone.screen.ScreenRoute
import com.genius.tvhub.feature.phone.services.ServicesRoute
import com.genius.tvhub.feature.phone.services.TerminalRoute
import com.genius.tvhub.feature.phone.settings.SettingsRoute

/**
 * The phone: the remote is home; every other page opens from the deck with a gentle scale-in and
 * goes back to the remote. Each page lives in its own module.
 */
@Composable
fun PhoneRoot() {
    val nav = rememberNavController()
    val back: () -> Unit = { nav.popBackStack() }
    NavHost(
        nav, startDestination = "remote",
        enterTransition = { fadeIn(tween(220)) + scaleIn(tween(260), initialScale = 0.96f) },
        exitTransition = { fadeOut(tween(160)) },
        popEnterTransition = { fadeIn(tween(200)) },
        popExitTransition = { fadeOut(tween(160)) + scaleOut(tween(200), targetScale = 0.96f) },
    ) {
        composable("remote") { RemoteRoute(onOpen = { d -> nav.navigate(d.route()) }) }
        composable("screen") { ScreenRoute(onClose = back, onKeyboard = back) }
        composable("mouse") { MouseRoute(onBack = back) }
        composable("device") { DeviceRoute(onBack = back) }
        composable("apps") { AppsRoute(onBack = back) }
        composable("files") { FilesRoute(onBack = back) }
        composable("services") { ServicesRoute(onBack = back, onTerminal = { nav.navigate("terminal") }) }
        composable("terminal") { TerminalRoute(onBack = back) }
        composable("settings") { SettingsRoute(onBack = back) }
    }
}

private fun Destination.route() = when (this) {
    Destination.SCREEN -> "screen"
    Destination.MOUSE -> "mouse"
    Destination.KEYBOARD -> "remote"
    Destination.DEVICE -> "device"
    Destination.APPS -> "apps"
    Destination.FILES -> "files"
    Destination.SERVICES -> "services"
    Destination.SETTINGS -> "settings"
}
