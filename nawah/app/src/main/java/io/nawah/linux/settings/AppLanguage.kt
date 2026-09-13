package io.nawah.linux.settings

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

/**
 * The languages the app ships, plus "follow the system".
 *
 * A list rather than a free locale picker because this is not a translation
 * platform: there are exactly two `values` folders, and offering a language
 * with no strings behind it would just show English with an Arabic label.
 */
enum class AppLanguage(val tag: String?) {
    /** Whatever the phone is set to. The default, and right for most people. */
    SYSTEM(null),
    ARABIC("ar"),
    ENGLISH("en"),
    ;

    companion object {
        fun fromTag(tag: String?): AppLanguage =
            entries.firstOrNull { it.tag == tag } ?: SYSTEM
    }
}

/**
 * Applies a stored language choice to a [Context].
 *
 * Done by hand rather than through `AppCompatDelegate.setApplicationLocales`
 * because the app has no AppCompat dependency at all — it is Compose and
 * `ComponentActivity` — and pulling in an entire support library plus a
 * manifest service to set one `Locale` would be a poor trade.
 *
 * Both the Application and the Activity are wrapped. Wrapping only the Activity
 * looks correct until a notification appears: the installer and the session
 * service resolve their strings against the Application context, and those
 * would have stayed in the system language.
 */
object LocaleWrapper {

    fun wrap(base: Context, settings: AppSettings = AppSettings(base)): Context {
        val tag = settings.languageTag ?: return base
        val locale = Locale.forLanguageTag(tag)
        Locale.setDefault(locale)
        val config = Configuration(base.resources.configuration).apply {
            setLocale(locale)
            setLayoutDirection(locale)
        }
        return base.createConfigurationContext(config)
    }
}
