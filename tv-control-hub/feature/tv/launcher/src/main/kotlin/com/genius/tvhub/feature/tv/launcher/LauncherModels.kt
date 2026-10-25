package com.genius.tvhub.feature.tv.launcher

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap

/** One app as the launcher shows it. [accent] is the icon's dominant colour: it lights the room. */
@Immutable
data class LauncherApp(
    val packageName: String,
    val label: String,
    val icon: ImageBitmap?,
    val accent: Color,
    val isTvApp: Boolean,
)

enum class IconSize(val dock: Int, val grid: Int) { NORMAL(80, 64), LARGE(92, 76) }

/** Everything the "Interface" settings page controls. */
@Immutable
data class Appearance(
    val glow: Float = 0.7f,
    /** Off: the app's own icon only. On: the icon on a glass tile. */
    val iconFrames: Boolean = false,
    val motion: Boolean = true,
    val iconSize: IconSize = IconSize.LARGE,
    val labels: Boolean = true,
    val clock24h: Boolean = true,
    val widgets: List<WidgetKind> = listOf(WidgetKind.PHONE, WidgetKind.DEVICE, WidgetKind.SHORTCUTS),
)

/** Home extensions the user can add, remove and reorder. */
enum class WidgetKind { PHONE, DEVICE, SHORTCUTS }

/** A home shortcut: one press does something that would otherwise take several. */
@Immutable
data class HomeShortcut(val id: String, val label: String, val action: ShortcutAction)

sealed interface ShortcutAction {
    data class OpenUrl(val url: String) : ShortcutAction
    data class LaunchApp(val packageName: String) : ShortcutAction
    data object TogglePointer : ShortcutAction
    data object OpenSettings : ShortcutAction
}

@Immutable
data class LauncherState(
    val space: List<LauncherApp> = emptyList(),
    val all: List<LauncherApp> = emptyList(),
    val shortcuts: List<HomeShortcut> = emptyList(),
    val phoneName: String? = null,
    val pointerOn: Boolean = false,
    val online: Boolean = true,
    val ramFraction: Float? = null,
    val storageFraction: Float? = null,
    val setupStepsLeft: Int = 0,
    val appearance: Appearance = Appearance(),
)

interface LauncherActions {
    fun launch(app: LauncherApp)
    fun toggleSpace(app: LauncherApp)
    fun appInfo(app: LauncherApp)
    fun uninstall(app: LauncherApp)
    fun run(shortcut: HomeShortcut)
    fun addApp(source: AddSource)
    fun openSettings()
}

enum class AddSource { PHONE, FILES, LINK }
