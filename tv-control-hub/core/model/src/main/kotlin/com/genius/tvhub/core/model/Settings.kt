package com.genius.tvhub.core.model

enum class AppLanguage { SYSTEM, ARABIC, ENGLISH }
/** AUTO picks LITE on low-RAM devices (the 2 GB TV box), FULL elsewhere. */
enum class VisualEffects { AUTO, FULL, LITE }

/**
 * Every user choice, both roles. Defaults are the "nothing to configure" experience.
 * There is no light theme: the product is charcoal only, by decision.
 */
data class HubSettings(
    val language: AppLanguage = AppLanguage.SYSTEM,
    val effects: VisualEffects = VisualEffects.AUTO,
    val roleOverride: DeviceRole? = null,
    // phone
    val remoteHintSeen: Boolean = false,
    val volumeKeysControlTv: Boolean = true,
    val autoKeyboard: Boolean = true,
    val liveBackdrop: Boolean = true,
    val lastTvId: String? = null,
    // tv
    val tvName: String? = null,
    val startOnBoot: Boolean = true,
    val remoteMouseLongPress: Boolean = true,
    val autoMouseForPhoneApps: Boolean = true,
    val launcherTakesHome: Boolean = false,
    val autoApproveNew: Boolean = false,
    val favorites: List<String> = emptyList(),
    /** 0..1; how strongly the focused app's colour lights the room. */
    val glow: Float = 0.7f,
    val motion: Boolean = true,
    /** Off = the app's own icon only; on = the icon sits on a glass tile. */
    val iconFrames: Boolean = false,
    val largeIcons: Boolean = true,
    val showLabels: Boolean = true,
    val widgetPhone: Boolean = true,
    val widgetDevice: Boolean = true,
    val widgetShortcuts: Boolean = true,
)

/** A phone the TV trusts. */
data class TrustedDevice(
    val id: String,
    val name: String,
    val model: String,
    val publicKey: ByteArray,
    val grants: Grants,
    val pairedAt: Long,
    val lastSeenAt: Long,
)

/** A TV the phone has paired with. */
data class PairedTv(
    val id: String,
    val name: String,
    val publicKey: ByteArray,
    val host: String,
    val port: Int,
    val pairedAt: Long,
    val lastConnectedAt: Long,
)
