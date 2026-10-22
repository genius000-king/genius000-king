package com.tvhub.tv.navigation

import androidx.annotation.StringRes
import com.tvhub.tv.R

/**
 * The six TV screens. Each one is reached with the D-pad from the home list,
 * and each one stays separate, so the TV never mixes tools on one screen.
 * [plannedPhase] is the roadmap phase that delivers the screen (see docs/ROADMAP.md).
 */
enum class TvScreen(
    val route: String,
    @StringRes val label: Int,
    val plannedPhase: Int,
) {
    Home(route = "home", label = R.string.screen_home, plannedPhase = 2),
    Pairing(route = "pairing", label = R.string.screen_pairing, plannedPhase = 2),
    TrustedDevices(route = "trusted-devices", label = R.string.screen_trusted_devices, plannedPhase = 2),
    Permissions(route = "permissions", label = R.string.screen_permissions, plannedPhase = 2),
    ActiveServices(route = "active-services", label = R.string.screen_active_services, plannedPhase = 6),
    Settings(route = "settings", label = R.string.screen_settings, plannedPhase = 2),
}
