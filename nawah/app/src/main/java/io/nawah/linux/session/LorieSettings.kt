package io.nawah.linux.session

import android.content.Context

/**
 * Writes the X display's own preferences before its activity opens.
 *
 * The wizard has always asked for a resolution and the answer has always gone
 * nowhere: it was exported into the container as `NAWAH_DISPLAY_WIDTH`, which
 * nothing reads. The screen size is not the guest's to choose — it belongs to
 * the X server on this side, and the X server takes it from the preference
 * store the vendored `:lorie` module shares with its settings activity.
 *
 * So this writes into that store directly. `PreferenceManager` builds its
 * default name as `<package>_preferences`, and because `:lorie` is compiled
 * into this APK, that is our package and our file — no cross-app access and no
 * change to vendored code.
 */
internal class LorieSettings(context: Context) {

    private val prefs = context.getSharedPreferences(
        "${context.packageName}_preferences",
        Context.MODE_PRIVATE,
    )

    /**
     * Pins the display to [width] x [height].
     *
     * `custom` rather than `exact`: `exact` is a list preference whose values
     * come from a fixed array in the vendored module, so a size the wizard
     * offers but that array does not contain would be silently ignored.
     * `custom` is a free string and is parsed as `WxH`.
     */
    fun applyResolution(width: Int, height: Int) {
        if (width <= 0 || height <= 0) return
        prefs.edit()
            .putString(KEY_RESOLUTION_MODE, MODE_CUSTOM)
            .putString(KEY_RESOLUTION_CUSTOM, "${width}x$height")
            .apply()
    }

    /**
     * Keeps the display awake, or hands the decision back to the system.
     *
     * `never` means "never time out". The values are the vendored module's,
     * from `R.array.screenIdleTimeoutValues`.
     */
    fun applyKeepScreenOn(keepOn: Boolean) {
        prefs.edit()
            .putString(KEY_SCREEN_IDLE, if (keepOn) IDLE_NEVER else IDLE_SYSTEM)
            .apply()
    }

    internal companion object {
        const val KEY_RESOLUTION_MODE = "displayResolutionMode"
        const val KEY_RESOLUTION_CUSTOM = "displayResolutionCustom"
        const val KEY_SCREEN_IDLE = "screenIdleTimeout"
        const val MODE_CUSTOM = "custom"
        const val IDLE_NEVER = "never"
        const val IDLE_SYSTEM = "system"
    }
}
