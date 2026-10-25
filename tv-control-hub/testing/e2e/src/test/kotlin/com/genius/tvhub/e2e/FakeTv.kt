package com.genius.tvhub.e2e

import com.genius.tvhub.runtime.host.*

import com.genius.tvhub.core.model.AppInfo
import com.genius.tvhub.core.model.CapabilityCheck
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.model.CpuReading
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.FileRoot
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkKind
import com.genius.tvhub.core.model.MemoryReading
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.NetworkReading
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.Reading
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.RootKind
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ServiceState
import com.genius.tvhub.core.model.ServiceStatus
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.model.StreamQuality
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.core.model.ThermalLevel
import com.genius.tvhub.core.model.ThermalReading
import com.genius.tvhub.core.protocol.InstallState
import com.genius.tvhub.engine.apps.api.AppsEngine
import com.genius.tvhub.engine.apps.api.IconResult
import com.genius.tvhub.engine.apps.api.InstallUpdate
import com.genius.tvhub.engine.input.api.EditKind
import com.genius.tvhub.engine.input.api.FocusedField
import com.genius.tvhub.engine.input.api.InputEngine
import com.genius.tvhub.engine.input.api.InputPrefs
import com.genius.tvhub.engine.input.api.InputResult
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

/** A whole TV in memory: every engine faked, every action recorded. Shared by router and E2E tests. */
class FakeTv {
    val log = mutableListOf<String>()
    var inputReady = true
    val focus = MutableStateFlow<FocusedField?>(null)
    val files = mutableMapOf<String, ByteArray>()
    val installs = mutableMapOf<String, MutableList<ByteArray>>()

    val input = object : InputEngine {
        override val ready: StateFlow<Boolean> = MutableStateFlow(true)
        override val focusedField: Flow<FocusedField?> = focus
        private fun r(what: String): InputResult { log += what; return if (inputReady) InputResult.Done else InputResult.NotReady }
        override suspend fun key(action: KeyAction) = r("key:$action")
        override suspend fun tap(at: NormPoint) = r("tap:${at.x},${at.y}")
        override suspend fun longPress(at: NormPoint) = r("long")
        override suspend fun swipe(points: List<NormPoint>, durationMillis: Long) = r("swipe:${points.size}")
        override suspend fun text(text: String, mode: TextMode) = r("text:$text")
        override suspend fun edit(action: EditKind) = r("edit:$action")
        override suspend fun cursorMove(dx: Float, dy: Float) = r("move")
        override suspend fun cursorClick(long: Boolean) = r("click")
        override suspend fun cursorScroll(dx: Float, dy: Float) = r("scroll")
        override suspend fun cursorVisible(visible: Boolean) = r("cursor:$visible")
        override fun configure(prefs: InputPrefs) {}
    }

    val apps = object : AppsEngine {
        override val changes: Flow<Unit> = emptyFlow()
        override suspend fun list() = listOf(AppInfo("yt", "YouTube", "1", true, false, 0, 0), AppInfo("brave", "Brave", "1", false, false, 0, 0))
        override suspend fun icon(packageName: String, sizePx: Int) = IconResult(byteArrayOf(1, 2, 3), 0)
        override fun launch(packageName: String) = (packageName != "missing").also { log += "launch:$packageName" }
        override fun uninstall(packageName: String) { log += "uninstall:$packageName" }
        override fun showInfo(packageName: String) {}
        override fun canInstall() = true
        override fun requestInstallPermission() {}
        override suspend fun beginInstall(label: String, splitSizes: List<Long>) = "inst-1".also { installs[it] = MutableList(splitSizes.size) { ByteArray(0) } }
        override suspend fun writeInstall(id: String, split: Int, offset: Long, data: ByteArray) { installs[id]!![split] = installs[id]!![split] + data }
        override fun commitInstall(id: String): Flow<InstallUpdate> = flowOf(InstallUpdate(InstallState.INSTALLING), InstallUpdate(InstallState.SUCCESS))
        override fun abortInstall(id: String) {}
    }

    val snapshot = MetricsSnapshot(
        1, 2, MemoryReading(2048, 1024, false, 1), emptyList(),
        CpuReading(Reading.unsupported("x"), Reading.needsAdb("blocked"), 0f),
        ThermalReading(Reading.of(ThermalLevel.NONE), Reading.unsupported("x"), Reading.unsupported("x")),
        NetworkReading(LinkKind.WIFI, listOf("10.0.0.2"), Reading.of(-50), Reading.of(400), 0, 0), 10,
    )

    val monitor = object : MonitorPort {
        override fun profile() = DeviceProfile("Xiaomi", "TV Box S", "14", 34, "2026-09", Reading.of("Amlogic S905X5M"), listOf("arm64-v8a"), 4, Reading.unsupported("x"), Reading.of("Mali-G310"), Reading.of("ARM"), Reading.of("ES 3.2"), 1920, 1080, 60f, 2048)
        override fun snapshot() = snapshot
        override fun metrics(): Flow<MetricsSnapshot> = flow { while (true) { emit(snapshot); delay(50) } }
        override fun checks() = emptyList<CapabilityCheck>()
    }

    val filesPort = object : FilesPort {
        override fun roots() = listOf(FileRoot("app", "TV Hub", RootKind.APP, true, 100, 50))
        override fun list(dir: RemotePath) = files.keys.map { FileEntry(RemotePath("app", it), false, files[it]!!.size.toLong(), 0, null) }
        override fun mkdir(path: RemotePath) { log += "mkdir:${path.path}" }
        override fun rename(path: RemotePath, newName: String) {}
        override fun delete(paths: List<RemotePath>) { paths.forEach { files.remove(it.path) } }
        override fun copy(sources: List<RemotePath>, dest: RemotePath) {}
        override fun move(sources: List<RemotePath>, dest: RemotePath) {}
        private val uploads = mutableMapOf<String, Pair<String, java.io.ByteArrayOutputStream>>()
        override fun beginUpload(path: RemotePath, size: Long, overwrite: Boolean) = "up-${path.path}".also { uploads[it] = path.path to java.io.ByteArrayOutputStream() }
        override fun writeChunk(id: String, offset: Long, data: ByteArray) { uploads[id]!!.second.write(data) }
        override fun commit(id: String) { uploads.remove(id)!!.let { (p, b) -> files[p] = b.toByteArray() } }
        override fun beginDownload(path: RemotePath) = path.path to files[path.path]!!.size.toLong()
        override fun readChunk(id: String, offset: Long, max: Int): Pair<ByteArray, Boolean> {
            val all = files[id]!!; val end = minOf(all.size.toLong(), offset + max).toInt()
            return all.copyOfRange(offset.toInt(), end) to (end >= all.size)
        }
        override fun end(id: String) {}
    }

    val shell = object : ShellPort {
        override suspend fun run(backend: ShellBackend, command: String, timeoutMillis: Long) = CommandResult(0, "ran $command", "", 1, false)
    }

    val services = object : ServicesPort {
        val specs = mutableMapOf<String, ServiceSpec>()
        override suspend fun list() = specs.values.map { it to ServiceStatus(it.id, ServiceState.STOPPED) }
        override suspend fun save(spec: ServiceSpec) { specs[spec.id] = spec }
        override suspend fun remove(id: String) { specs.remove(id) }
        override suspend fun start(id: String) { log += "svc-start:$id" }
        override suspend fun stop(id: String) {}
        override suspend fun restart(id: String) {}
        override suspend fun logs(id: String, lines: Int) = listOf("line1", "line2")
    }

    val stream = object : StreamPort {
        override fun requestKeyFrame() { log += "keyframe" }
        override fun setQuality(quality: StreamQuality) {}
    }

    val ports = HostPorts(input, apps, monitor, filesPort, shell, services, stream)
}
