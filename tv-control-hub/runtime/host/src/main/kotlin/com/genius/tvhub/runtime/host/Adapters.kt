package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.data.ServiceStore
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceState
import com.genius.tvhub.core.model.ServiceStatus
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.engine.files.FilesEngine
import com.genius.tvhub.engine.monitor.MonitorEngine
import com.genius.tvhub.engine.shell.sandbox.SandboxShell
import com.genius.tvhub.engine.shell.services.ServiceManager
import com.genius.tvhub.engine.shell.termux.TermuxBridge
import com.genius.tvhub.engine.adb.api.AdbEngine
import com.genius.tvhub.engine.adb.api.AdbState
import com.genius.tvhub.engine.stream.StreamEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/* Thin adapters from engines to the router's ports. No logic beyond translation. */

class MonitorAdapter(private val engine: MonitorEngine) : MonitorPort {
    override fun profile() = engine.profile()
    override fun snapshot() = engine.snapshot()
    override fun metrics() = engine.metrics()
    override fun checks() = engine.checks()
}

class FilesAdapter(private val engine: FilesEngine) : FilesPort {
    override fun roots() = engine.roots.roots()
    override fun list(dir: RemotePath): List<FileEntry> = engine.ops.list(dir)
    override fun mkdir(path: RemotePath) = engine.ops.mkdir(path)
    override fun rename(path: RemotePath, newName: String) = engine.ops.rename(path, newName)
    override fun delete(paths: List<RemotePath>) = engine.ops.delete(paths)
    override fun copy(sources: List<RemotePath>, dest: RemotePath) = engine.ops.copy(sources, dest)
    override fun move(sources: List<RemotePath>, dest: RemotePath) = engine.ops.move(sources, dest)
    override fun beginUpload(path: RemotePath, size: Long, overwrite: Boolean) = engine.transfers.beginUpload(path, size, overwrite)
    override fun writeChunk(id: String, offset: Long, data: ByteArray) = engine.transfers.writeChunk(id, offset, data)
    override fun commit(id: String) = engine.transfers.commit(id)
    override fun beginDownload(path: RemotePath) = engine.transfers.beginDownload(path)
    override fun readChunk(id: String, offset: Long, max: Int) = engine.transfers.readChunk(id, offset, max)
    override fun end(id: String) = engine.transfers.end(id)
}

class ShellAdapter(private val sandbox: SandboxShell, private val termux: TermuxBridge) : ShellPort {
    override suspend fun run(backend: ShellBackend, command: String, timeoutMillis: Long): CommandResult = when (backend) {
        ShellBackend.SANDBOX -> withContext(Dispatchers.IO) { sandbox.run(command, timeoutMillis) }
        ShellBackend.TERMUX -> termux.run(command, timeoutMillis)
    }
}

class ServicesAdapter(private val store: ServiceStore, private val manager: ServiceManager, private val termux: TermuxBridge) : ServicesPort {
    private val installLock = Mutex()
    private var installed = false

    private suspend fun ready() {
        if (!termux.installed()) throw RemoteException(ErrorCode.UNAVAILABLE, "install Termux on the TV to run services")
        installLock.withLock { if (!installed) { manager.install(); installed = true } }
    }

    override suspend fun list(): List<Pair<ServiceSpec, ServiceStatus>> {
        val specs = store.all()
        val statuses = runCatching { ready(); manager.status(specs.map { it.id }) }.getOrDefault(emptyList()).associateBy { it.id }
        return specs.map { it to (statuses[it.id] ?: ServiceStatus(it.id, ServiceState.UNKNOWN)) }
    }

    override suspend fun save(spec: ServiceSpec) {
        if (!spec.id.matches(Regex("[A-Za-z0-9_-]{1,40}"))) throw RemoteException(ErrorCode.INVALID, "id: letters, digits, - and _ only")
        store.save(spec)
    }

    override suspend fun remove(id: String) { runCatching { stop(id) }; store.remove(id) }
    override suspend fun start(id: String) { ready(); manager.start(spec(id)) }
    override suspend fun stop(id: String) { ready(); manager.stop(id) }
    override suspend fun restart(id: String) { ready(); manager.restart(spec(id)) }
    override suspend fun logs(id: String, lines: Int): List<String> { ready(); return manager.logs(id, lines) }

    private suspend fun spec(id: String) = store.all().firstOrNull { it.id == id } ?: throw RemoteException(ErrorCode.NOT_FOUND, "no service $id")
}

class StreamAdapter(private val engine: StreamEngine, private val adb: AdbEngine) : StreamPort {
    override fun requestKeyFrame() {
        if (adb.state.value == AdbState.Ready) adb.requestKeyFrame() else engine.requestKeyFrame()
    }
    override fun setQuality(quality: StreamQuality) = Unit // takes effect on the next stream start
}
