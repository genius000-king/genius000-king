package com.genius.tvhub.engine.apps.api

import com.genius.tvhub.core.model.AppInfo
import com.genius.tvhub.core.protocol.InstallState
import kotlinx.coroutines.flow.Flow

/** Apps on the TV: the catalogue, launching, and installing. */
interface AppsEngine {
    /** Re-emits when apps are installed, updated or removed. */
    val changes: Flow<Unit>

    suspend fun list(): List<AppInfo>
    suspend fun icon(packageName: String, sizePx: Int): IconResult?
    fun launch(packageName: String): Boolean
    fun uninstall(packageName: String)
    fun showInfo(packageName: String)

    /** Whether Android lets this app install packages (the "unknown sources" switch). */
    fun canInstall(): Boolean
    fun requestInstallPermission()

    suspend fun beginInstall(label: String, splitSizes: List<Long>): String
    suspend fun writeInstall(id: String, split: Int, offset: Long, data: ByteArray)
    /** Commits and reports progress until a final state (SUCCESS or FAILED). */
    fun commitInstall(id: String): Flow<InstallUpdate>
    fun abortInstall(id: String)
}

/** PNG bytes plus the icon's accent colour (ARGB). */
class IconResult(val png: ByteArray, val accent: Int)

data class InstallUpdate(val state: InstallState, val message: String = "")
