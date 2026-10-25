package com.genius.tvhub.core.protocol

import com.genius.tvhub.core.model.AppInfo
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.FileRoot
import com.genius.tvhub.core.model.HostStatus
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceStatus
import com.genius.tvhub.core.model.VideoFormat
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
sealed interface Reply {
    @Serializable @SerialName("ok") data object Ok : Reply
    @Serializable @SerialName("err") data class Error(val code: ErrorCode, val message: String) : Reply
    @Serializable @SerialName("pong") data class Pong(val sentAt: Long, val receivedAt: Long) : Reply
    @Serializable @SerialName("status") data class Status(val status: HostStatus) : Reply
    @Serializable @SerialName("profile") data class Profile(val profile: DeviceProfile) : Reply
    @Serializable @SerialName("roots") data class Roots(val roots: List<FileRoot>) : Reply
    @Serializable @SerialName("dir") data class Dir(val entries: List<FileEntry>) : Reply
    @Serializable @SerialName("xfer") data class Transfer(val transferId: String, val size: Long) : Reply
    @Serializable @SerialName("bytes") data class Bytes(val data: ByteArray, val eof: Boolean = false) : Reply
    @Serializable @SerialName("apps") data class Apps(val apps: List<AppInfo>) : Reply
    @Serializable @SerialName("cmd") data class Command(val result: CommandResult) : Reply
    @Serializable @SerialName("svcs") data class Services(val services: List<ServiceEntry>) : Reply
    @Serializable @SerialName("logs") data class Logs(val lines: List<String>) : Reply
}

@Serializable
data class ServiceEntry(val spec: ServiceSpec, val status: ServiceStatus)

/** Unsolicited messages from the TV. */
@Serializable
sealed interface Push {
    @Serializable @SerialName("metrics") data class Metrics(val snapshot: MetricsSnapshot) : Push
    @Serializable @SerialName("status") data class StatusChanged(val status: HostStatus) : Push
    @Serializable @SerialName("stream") data class StreamState(val active: Boolean, val format: VideoFormat?) : Push
    @Serializable @SerialName("install") data class InstallProgress(val transferId: String, val state: InstallState, val message: String = "") : Push
    @Serializable @SerialName("svc") data class ServicesChanged(val services: List<ServiceEntry>) : Push
    /** The TV revoked this phone; the phone forgets the TV's session and shows why. */
    @Serializable @SerialName("bye") data class Goodbye(val reason: String) : Push
}

enum class InstallState { WAITING_FOR_USER, INSTALLING, SUCCESS, FAILED }
