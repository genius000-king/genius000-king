package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.model.CapabilityCheck
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.FileRoot
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceStatus
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.engine.apps.api.AppsEngine
import com.genius.tvhub.engine.input.api.InputEngine
import kotlinx.coroutines.flow.Flow

/**
 * What the call router needs from each engine, as small interfaces. The router never touches
 * Android; adapters do. Tests plug in fakes and drive the real router end to end.
 */
interface MonitorPort {
    fun profile(): DeviceProfile
    fun snapshot(): MetricsSnapshot
    fun metrics(): Flow<MetricsSnapshot>
    fun checks(): List<CapabilityCheck>
}

interface FilesPort {
    fun roots(): List<FileRoot>
    fun list(dir: RemotePath): List<FileEntry>
    fun mkdir(path: RemotePath)
    fun rename(path: RemotePath, newName: String)
    fun delete(paths: List<RemotePath>)
    fun copy(sources: List<RemotePath>, dest: RemotePath)
    fun move(sources: List<RemotePath>, dest: RemotePath)
    fun beginUpload(path: RemotePath, size: Long, overwrite: Boolean): String
    fun writeChunk(id: String, offset: Long, data: ByteArray)
    fun commit(id: String)
    fun beginDownload(path: RemotePath): Pair<String, Long>
    fun readChunk(id: String, offset: Long, max: Int): Pair<ByteArray, Boolean>
    fun end(id: String)
}

interface ShellPort {
    suspend fun run(backend: ShellBackend, command: String, timeoutMillis: Long): CommandResult
}

interface ServicesPort {
    suspend fun list(): List<Pair<ServiceSpec, ServiceStatus>>
    suspend fun save(spec: ServiceSpec)
    suspend fun remove(id: String)
    suspend fun start(id: String)
    suspend fun stop(id: String)
    suspend fun restart(id: String)
    suspend fun logs(id: String, lines: Int): List<String>
}

interface StreamPort {
    fun requestKeyFrame()
    fun setQuality(quality: StreamQuality)
}

class HostPorts(
    val input: InputEngine,
    val apps: AppsEngine,
    val monitor: MonitorPort,
    val files: FilesPort,
    val shell: ShellPort,
    val services: ServicesPort,
    val stream: StreamPort,
)
