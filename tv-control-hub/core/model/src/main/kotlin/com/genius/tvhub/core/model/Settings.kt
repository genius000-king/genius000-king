package com.genius.tvhub.core.model

enum class ThemeMode { SYSTEM, DARK, LIGHT }
enum class AppLanguage { SYSTEM, ARABIC, ENGLISH }
/** AUTO picks LITE on low-RAM devices (the 2 GB TV box), FULL elsewhere. */
enum class VisualEffects { AUTO, FULL, LITE }

/** Every user choice, both roles. Defaults are the "nothing to configure" experience. */
data class HubSettings(
    val theme: ThemeMode = ThemeMode.DARK,
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
