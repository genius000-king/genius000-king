package com.genius.tvhub.core.model

import kotlinx.serialization.Serializable

@Serializable
data class AppInfo(
    val packageName: String,
    val label: String,
    val versionName: String?,
    /** Declares a TV (leanback) launcher entry; otherwise it is a phone app the TV home hides. */
    val isTvApp: Boolean,
    val isSystem: Boolean,
    val installedAt: Long,
    val sizeBytes: Long,
)
