package com.genius.tvhub.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.VisualEffects
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/** All settings in one DataStore. Unknown or corrupt values fall back to the defaults. */
@Singleton
class SettingsStore @Inject constructor(private val store: DataStore<Preferences>) {

    val settings: Flow<HubSettings> = store.data.map(::read)

    suspend fun current(): HubSettings = settings.first()

    suspend fun update(change: (HubSettings) -> HubSettings) {
        store.edit { prefs -> write(prefs, change(read(prefs))) }
    }

    private object K {
        val glow = androidx.datastore.preferences.core.floatPreferencesKey("glow")
        val motion = booleanPreferencesKey("motion")
        val iconFrames = booleanPreferencesKey("icon_frames")
        val largeIcons = booleanPreferencesKey("large_icons")
        val labels = booleanPreferencesKey("labels")
        val wPhone = booleanPreferencesKey("w_phone")
        val wDevice = booleanPreferencesKey("w_device")
        val wShortcuts = booleanPreferencesKey("w_shortcuts")
        val language = stringPreferencesKey("language")
        val effects = stringPreferencesKey("effects")
        val role = stringPreferencesKey("role")
        val hintSeen = booleanPreferencesKey("hint_seen")
        val volumeKeys = booleanPreferencesKey("volume_keys")
        val autoKeyboard = booleanPreferencesKey("auto_keyboard")
        val liveBackdrop = booleanPreferencesKey("live_backdrop")
        val lastTv = stringPreferencesKey("last_tv")
        val tvName = stringPreferencesKey("tv_name")
        val boot = booleanPreferencesKey("start_on_boot")
        val mouseLongPress = booleanPreferencesKey("mouse_long_press")
        val autoMouse = booleanPreferencesKey("auto_mouse")
        val takeHome = booleanPreferencesKey("take_home")
        val autoApprove = booleanPreferencesKey("auto_approve")
        val favorites = stringPreferencesKey("favorites")
    }

    private inline fun <reified E : Enum<E>> Preferences.enum(key: Preferences.Key<String>, default: E): E =
        this[key]?.let { v -> enumValues<E>().firstOrNull { it.name == v } } ?: default

    private fun read(p: Preferences): HubSettings {
        val d = HubSettings()
        return HubSettings(
            language = p.enum(K.language, d.language),
            effects = p.enum(K.effects, d.effects),
            roleOverride = p[K.role]?.let { v -> DeviceRole.entries.firstOrNull { it.name == v } },
            remoteHintSeen = p[K.hintSeen] ?: d.remoteHintSeen,
            volumeKeysControlTv = p[K.volumeKeys] ?: d.volumeKeysControlTv,
            autoKeyboard = p[K.autoKeyboard] ?: d.autoKeyboard,
            liveBackdrop = p[K.liveBackdrop] ?: d.liveBackdrop,
            lastTvId = p[K.lastTv],
            tvName = p[K.tvName],
            startOnBoot = p[K.boot] ?: d.startOnBoot,
            remoteMouseLongPress = p[K.mouseLongPress] ?: d.remoteMouseLongPress,
            autoMouseForPhoneApps = p[K.autoMouse] ?: d.autoMouseForPhoneApps,
            launcherTakesHome = p[K.takeHome] ?: d.launcherTakesHome,
            autoApproveNew = p[K.autoApprove] ?: d.autoApproveNew,
            favorites = p[K.favorites]?.split('\n')?.filter { it.isNotBlank() } ?: d.favorites,
            glow = p[K.glow]?.coerceIn(0f, 1f) ?: d.glow,
            motion = p[K.motion] ?: d.motion,
            iconFrames = p[K.iconFrames] ?: d.iconFrames,
            largeIcons = p[K.largeIcons] ?: d.largeIcons,
            showLabels = p[K.labels] ?: d.showLabels,
            widgetPhone = p[K.wPhone] ?: d.widgetPhone,
            widgetDevice = p[K.wDevice] ?: d.widgetDevice,
            widgetShortcuts = p[K.wShortcuts] ?: d.widgetShortcuts,
        )
    }

    private fun write(p: androidx.datastore.preferences.core.MutablePreferences, s: HubSettings) {
        p[K.language] = s.language.name
        p[K.effects] = s.effects.name
        s.roleOverride?.let { p[K.role] = it.name } ?: p.remove(K.role)
        p[K.hintSeen] = s.remoteHintSeen
        p[K.volumeKeys] = s.volumeKeysControlTv
        p[K.autoKeyboard] = s.autoKeyboard
        p[K.liveBackdrop] = s.liveBackdrop
        s.lastTvId?.let { p[K.lastTv] = it } ?: p.remove(K.lastTv)
        s.tvName?.let { p[K.tvName] = it } ?: p.remove(K.tvName)
        p[K.boot] = s.startOnBoot
        p[K.mouseLongPress] = s.remoteMouseLongPress
        p[K.autoMouse] = s.autoMouseForPhoneApps
        p[K.takeHome] = s.launcherTakesHome
        p[K.autoApprove] = s.autoApproveNew
        p[K.favorites] = s.favorites.joinToString("\n")
        p[K.glow] = s.glow
        p[K.motion] = s.motion
        p[K.iconFrames] = s.iconFrames
        p[K.largeIcons] = s.largeIcons
        p[K.labels] = s.showLabels
        p[K.wPhone] = s.widgetPhone
        p[K.wDevice] = s.widgetDevice
        p[K.wShortcuts] = s.widgetShortcuts
    }
}
