package io.nawah.linux.ui.state

import androidx.compose.runtime.Immutable
import io.nawah.linux.settings.AppLanguage

@Immutable
data class AppSettingsUiState(
    val language: AppLanguage = AppLanguage.SYSTEM,
    val keepScreenOn: Boolean = false,
    val openDisplayOnRun: Boolean = true,
    /** Sum of every machine's directory. -1 until measured. */
    val usedBytes: Long = -1L,
    val freeBytes: Long = 0L,
    val machineCount: Int = 0,
)
