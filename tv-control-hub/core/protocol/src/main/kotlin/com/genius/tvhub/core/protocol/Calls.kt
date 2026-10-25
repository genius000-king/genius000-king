package com.genius.tvhub.core.protocol

import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.model.TextMode
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * A request from the phone. Grouped by the engine that answers it; [Call.domain] is what the
 * host's permission gate checks.
 */
@Serializable
sealed interface Call {
    val domain: Domain

    // ---- session ----
    @Serializable @SerialName("ping") data class Ping(val sentAt: Long) : Call { override val domain get() = Domain.SESSION }
    @Serializable @SerialName("status") data object GetStatus : Call { override val domain get() = Domain.SESSION }

    // ---- input ----
    @Serializable @SerialName("key") data class Key(val action: KeyAction) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("tap") data class Tap(val at: NormPoint) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("long") data class LongPress(val at: NormPoint) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("swipe") data class Swipe(val points: List<NormPoint>, val durationMillis: Long) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("text") data class Text(val text: String, val mode: TextMode) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("edit") data class Edit(val action: EditAction) : Call { override val domain get() = Domain.INPUT }
    /** Relative pointer move in TV pixels. */
    @Serializable @SerialName("cmove") data class CursorMove(val dx: Float, val dy: Float) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("cclick") data class CursorClick(val long: Boolean = false) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("cscroll") data class CursorScroll(val dx: Float, val dy: Float) : Call { override val domain get() = Domain.INPUT }
    @Serializable @SerialName("cshow") data class CursorVisible(val visible: Boolean) : Call { override val domain get() = Domain.INPUT }

    // ---- monitor ----
    @Serializable @SerialName("profile") data object GetProfile : Call { override val domain get() = Domain.SYSTEM_INFO }
    @Serializable @SerialName("metrics") data class WatchMetrics(val on: Boolean) : Call { override val domain get() = Domain.SYSTEM_INFO }

    // ---- files ----
    @Serializable @SerialName("roots") data object ListRoots : Call { override val domain get() = Domain.FILES_READ }
    @Serializable @SerialName("ls") data class ListDir(val path: RemotePath) : Call { override val domain get() = Domain.FILES_READ }
    @Serializable @SerialName("mkdir") data class MakeDir(val path: RemotePath) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("mv1") data class Rename(val path: RemotePath, val newName: String) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("rm") data class Delete(val paths: List<RemotePath>) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("cp") data class Copy(val sources: List<RemotePath>, val destDir: RemotePath) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("mv") data class Move(val sources: List<RemotePath>, val destDir: RemotePath) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("upb") data class UploadBegin(val path: RemotePath, val size: Long, val overwrite: Boolean) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("upc") data class UploadChunk(val transferId: String, val offset: Long, val data: ByteArray) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("upe") data class UploadCommit(val transferId: String) : Call { override val domain get() = Domain.FILES_WRITE }
    @Serializable @SerialName("dlb") data class DownloadBegin(val path: RemotePath) : Call { override val domain get() = Domain.FILES_READ }
    @Serializable @SerialName("dlc") data class DownloadChunk(val transferId: String, val offset: Long, val maxBytes: Int) : Call { override val domain get() = Domain.FILES_READ }
    @Serializable @SerialName("xend") data class TransferAbort(val transferId: String) : Call { override val domain get() = Domain.SESSION }

    // ---- apps ----
    @Serializable @SerialName("apps") data object ListApps : Call { override val domain get() = Domain.APPS }
    @Serializable @SerialName("icon") data class AppIcon(val packageName: String, val sizePx: Int) : Call { override val domain get() = Domain.APPS }
    @Serializable @SerialName("launch") data class LaunchApp(val packageName: String) : Call { override val domain get() = Domain.APPS }
    @Serializable @SerialName("uninstall") data class UninstallApp(val packageName: String) : Call { override val domain get() = Domain.APPS }
    /** Starts an install of one app made of [splitSizes].size APK files (base first). */
    @Serializable @SerialName("instb") data class InstallBegin(val label: String, val splitSizes: List<Long>) : Call { override val domain get() = Domain.APPS }
    @Serializable @SerialName("instc") data class InstallChunk(val transferId: String, val split: Int, val offset: Long, val data: ByteArray) : Call { override val domain get() = Domain.APPS }
    @Serializable @SerialName("inste") data class InstallCommit(val transferId: String) : Call { override val domain get() = Domain.APPS }

    // ---- shell & services ----
    @Serializable @SerialName("run") data class RunCommand(val backend: ShellBackend, val command: String, val timeoutMillis: Long = 30_000) : Call { override val domain get() = Domain.SHELL }
    @Serializable @SerialName("svcs") data object ListServices : Call { override val domain get() = Domain.SERVICES }
    @Serializable @SerialName("svcsave") data class SaveService(val spec: ServiceSpec) : Call { override val domain get() = Domain.SERVICES }
    @Serializable @SerialName("svcdel") data class RemoveService(val id: String) : Call { override val domain get() = Domain.SERVICES }
    @Serializable @SerialName("svcdo") data class ControlService(val id: String, val action: ServiceAction) : Call { override val domain get() = Domain.SERVICES }
    @Serializable @SerialName("svclog") data class ServiceLogs(val id: String, val lines: Int = 200) : Call { override val domain get() = Domain.SERVICES }

    // ---- stream ----
    @Serializable @SerialName("sq") data class SetStreamQuality(val quality: StreamQuality) : Call { override val domain get() = Domain.SCREEN }
    @Serializable @SerialName("skey") data object RequestKeyFrame : Call { override val domain get() = Domain.SCREEN }
}

enum class Domain { SESSION, INPUT, SCREEN, SYSTEM_INFO, FILES_READ, FILES_WRITE, APPS, SHELL, SERVICES }

enum class EditAction { BACKSPACE, ENTER, CLEAR }

enum class ServiceAction { START, STOP, RESTART }
