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
     * Sets the display size as a percentage of the phone's own screen.
     *
     * ### Why not a pixel size
     * Because a pixel size was wrong, and shipped. Writing `custom` with
     * `1280x720` pinned the X screen to a 16:9 box on a 19.5:9 phone: the
     * desktop stopped filling the screen, gained black bars on every side, and
     * was then scaled up to the panel — which is what "it went blurry" was.
     *
     * `native` is the vendored module's own default and means "exactly the
     * surface", so the aspect ratio is right by construction. `scaled` divides
     * that by a percentage: 100 is native, 150 makes everything half again as
     * large on a screen two-thirds the pixels — lighter to draw, and readable
     * on a phone, with the aspect ratio still correct and the screen still
     * full.
     *
     * @param percent 100 for native; larger for a smaller, lighter X screen.
     */
    fun applyScale(percent: Int) {
        val editor = prefs.edit()
        if (percent <= NATIVE_PERCENT) {
            editor.putString(KEY_RESOLUTION_MODE, MODE_NATIVE)
        } else {
            editor.putString(KEY_RESOLUTION_MODE, MODE_SCALED)
            editor.putInt(KEY_SCALE, percent)
        }
        editor.apply()
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
        const val KEY_SCALE = "displayScale"
        const val KEY_SCREEN_IDLE = "screenIdleTimeout"
        const val MODE_NATIVE = "native"
        const val MODE_SCALED = "scaled"
        const val NATIVE_PERCENT = 100
        const val IDLE_NEVER = "never"
        const val IDLE_SYSTEM = "system"
    }
}
