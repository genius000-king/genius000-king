package com.genius.tvhub

import android.app.ActivityManager
import android.app.UiModeManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import com.genius.tvhub.core.designsystem.Effects
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.VisualEffects
import java.util.Locale

/** Which side of the product this device plays. A TV box reports leanback or the TV UI mode. */
object RoleDetector {
    fun detect(context: Context, override: DeviceRole? = null): DeviceRole {
        if (override != null) return override
        val pm = context.packageManager
        val tv = pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK) ||
            context.getSystemService(UiModeManager::class.java)?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
        return if (tv) DeviceRole.TV else DeviceRole.PHONE
    }

    /** The HOME alias is off by default; turned on only on the TV so phones never offer TV Hub as their launcher. */
    fun enableTvHome(context: Context) {
        val alias = ComponentName(context, "${context.packageName}.TvHome")
        if (context.packageManager.getComponentEnabledSetting(alias) != PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
            context.packageManager.setComponentEnabledSetting(alias, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
        }
    }

    /** Glass blur costs GPU every frame; the 2 GB TV box gets the design's own no-blur fallback. */
    fun effects(context: Context, choice: VisualEffects): Effects = when (choice) {
        VisualEffects.FULL -> Effects.FULL
        VisualEffects.LITE -> Effects.LITE
        VisualEffects.AUTO -> {
            val am = context.getSystemService(ActivityManager::class.java)
            val mem = ActivityManager.MemoryInfo().also(am::getMemoryInfo)
            if (am.isLowRamDevice || mem.totalMem < 3L * 1024 * 1024 * 1024) Effects.LITE else Effects.FULL
        }
    }
}

/**
 * The chosen language, mirrored synchronously: an Activity needs its locale before onCreate,
 * when DataStore cannot be read yet.
 */
object LocaleStore {
    private const val PREFS = "locale"
    private const val KEY = "language"

    fun saved(context: Context): AppLanguage =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)?.let { v -> AppLanguage.entries.firstOrNull { it.name == v } } ?: AppLanguage.SYSTEM

    /** Returns true when the language actually changed (the Activity should recreate). */
    fun save(context: Context, language: AppLanguage): Boolean {
        if (saved(context) == language) return false
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, language.name).apply()
        return true
    }

    fun wrap(base: Context): Context {
        val locale = when (saved(base)) {
            AppLanguage.ARABIC -> Locale("ar")
            AppLanguage.ENGLISH -> Locale.ENGLISH
            AppLanguage.SYSTEM -> return base
        }
        Locale.setDefault(locale)
        val config = Configuration(base.resources.configuration).apply { setLocale(locale); setLayoutDirection(locale) }
        return base.createConfigurationContext(config)
    }
}
