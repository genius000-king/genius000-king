package com.tvhub.app.mobile.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector
import com.tvhub.app.R

/** Bottom-bar sections. Pages belong to exactly one section. */
enum class MobileSection(
    val route: String,
    @StringRes val label: Int,
    val icon: ImageVector,
) {
    Home(route = "home", label = R.string.section_home, icon = Icons.Filled.Home),
    Control(route = "control", label = R.string.section_control, icon = Icons.Filled.PlayArrow),
    Device(route = "device", label = R.string.section_device, icon = Icons.Filled.Info),
    Tools(route = "tools", label = R.string.section_tools, icon = Icons.Filled.Build),
    Settings(route = "settings", label = R.string.section_settings, icon = Icons.Filled.Settings);

    val pages: List<MobilePage>
        get() = MobilePage.entries.filter { it.section == this }
}

/**
 * One page per function. Each page is its own screen, never a tab inside another page.
 * [plannedPhase] is the roadmap phase that delivers the page (see docs/ROADMAP.md).
 */
enum class MobilePage(
    val section: MobileSection,
    val route: String,
    @StringRes val label: Int,
    val plannedPhase: Int,
) {
    Stream(MobileSection.Control, "stream", R.string.page_stream, plannedPhase = 1),
    Remote(MobileSection.Control, "remote", R.string.page_remote, plannedPhase = 3),
    Touchpad(MobileSection.Control, "touchpad", R.string.page_touchpad, plannedPhase = 3),
    Keyboard(MobileSection.Control, "keyboard", R.string.page_keyboard, plannedPhase = 3),
    Shortcuts(MobileSection.Control, "shortcuts", R.string.page_shortcuts, plannedPhase = 3),

    Cpu(MobileSection.Device, "cpu", R.string.page_cpu, plannedPhase = 4),
    Gpu(MobileSection.Device, "gpu", R.string.page_gpu, plannedPhase = 4),
    Memory(MobileSection.Device, "memory", R.string.page_memory, plannedPhase = 4),
    Storage(MobileSection.Device, "storage", R.string.page_storage, plannedPhase = 4),
    Network(MobileSection.Device, "network", R.string.page_network, plannedPhase = 4),
    Live(MobileSection.Device, "live", R.string.page_live, plannedPhase = 4),

    Services(MobileSection.Tools, "services", R.string.page_services, plannedPhase = 6),
    Terminal(MobileSection.Tools, "terminal", R.string.page_terminal, plannedPhase = 6),
    Files(MobileSection.Tools, "files", R.string.page_files, plannedPhase = 5),
    Projects(MobileSection.Tools, "projects", R.string.page_apps, plannedPhase = 6),

    Connection(MobileSection.Settings, "connection", R.string.page_connection, plannedPhase = 2),
    Security(MobileSection.Settings, "security", R.string.page_security, plannedPhase = 2),
    Permissions(MobileSection.Settings, "permissions", R.string.page_permissions, plannedPhase = 2),
    Appearance(MobileSection.Settings, "appearance", R.string.page_appearance, plannedPhase = 2),
    PairedDevices(MobileSection.Settings, "paired-devices", R.string.page_devices, plannedPhase = 2),
    ;

    /** Full route such as "control/stream". */
    val fullRoute: String
        get() = "${section.route}/$route"
}
