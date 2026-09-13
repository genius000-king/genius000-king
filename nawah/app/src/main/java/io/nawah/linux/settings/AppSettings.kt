package io.nawah.linux.settings

import android.content.Context
import android.content.SharedPreferences

/**
 * The handful of choices that belong to the app rather than to one machine.
 *
 * SharedPreferences and not DataStore on purpose: every value here is read
 * synchronously during `attachBaseContext`, before any coroutine scope exists,
 * and a suspending read in that position can only be solved by blocking on it.
 */
class AppSettings(context: Context) {

    // Not applicationContext: the first read happens inside attachBaseContext,
    // where the Application has not been attached yet and that property is
    // still null. The base context serves preferences perfectly well, and this
    // crashed on the very first launch before a test caught it.
    private val prefs: SharedPreferences =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    /** Null means "follow the system", which is the default and usually right. */
    var languageTag: String?
        get() = prefs.getString(KEY_LANGUAGE, null)
        set(value) = prefs.edit().apply {
            if (value == null) remove(KEY_LANGUAGE) else putString(KEY_LANGUAGE, value)
        }.apply()

    /**
     * Keeps the screen on while a desktop is running.
     *
     * Default off. A session already holds a partial wake lock so the machine
     * survives the screen going off; this is only about the display itself, and
     * defaulting it on would flatten a battery overnight.
     */
    var keepScreenOn: Boolean
        get() = prefs.getBoolean(KEY_KEEP_SCREEN_ON, false)
        set(value) = prefs.edit().putBoolean(KEY_KEEP_SCREEN_ON, value).apply()

    /**
     * Opens the desktop as soon as a machine is started.
     *
     * Off means the session log is shown instead — which is what you want while
     * something is going wrong, and nobody wants once it works.
     */
    var openDisplayOnRun: Boolean
        get() = prefs.getBoolean(KEY_OPEN_DISPLAY, true)
        set(value) = prefs.edit().putBoolean(KEY_OPEN_DISPLAY, value).apply()

    private companion object {
        const val NAME = "nawah-settings"
        const val KEY_LANGUAGE = "language"
        const val KEY_KEEP_SCREEN_ON = "keep_screen_on"
        const val KEY_OPEN_DISPLAY = "open_display_on_run"
    }
}
