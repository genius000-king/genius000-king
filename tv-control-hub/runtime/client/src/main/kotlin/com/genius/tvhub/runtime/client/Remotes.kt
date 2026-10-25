package com.genius.tvhub.runtime.client

import com.genius.tvhub.core.model.AppInfo
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.FileRoot
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.RemotePath
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ShellBackend
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.EditAction
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.InstallState
import com.genius.tvhub.core.protocol.Push
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.core.protocol.Reply
import com.genius.tvhub.core.protocol.ServiceAction
import com.genius.tvhub.core.protocol.ServiceEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeoutOrNull
import java.io.InputStream
import java.io.OutputStream

/*
 * Typed views of the TV for the phone's screens, one per engine on the other side. Each is a thin
 * layer over HubClient calls, so a screen never builds protocol messages itself.
 */

class RemoteInput(private val hub: HubClient) {
    suspend fun key(k: KeyAction) = hub.call(Call.Key(k))
    suspend fun tap(at: NormPoint) = hub.call(Call.Tap(at))
    suspend fun longPress(at: NormPoint) = hub.call(Call.LongPress(at))
    suspend fun swipe(points: List<NormPoint>, millis: Long) = hub.call(Call.Swipe(points, millis))
    suspend fun text(t: String, mode: TextMode = TextMode.REPLACE) = hub.call(Call.Text(t, mode))
    suspend fun edit(a: EditAction) = hub.call(Call.Edit(a))
    suspend fun move(dx: Float, dy: Float) = hub.send(Call.CursorMove(dx, dy))
    suspend fun click(long: Boolean = false) = hub.call(Call.CursorClick(long))
    suspend fun scroll(dx: Float, dy: Float) = hub.send(Call.CursorScroll(dx, dy))
    suspend fun pointer(visible: Boolean) = hub.call(Call.CursorVisible(visible))
    /** The TV focused or left a text field: the phone keyboard follows. */
    val focus: Flow<Push.TextFocus> = hub.events.filterIsInstance()
}

class RemoteDevice(private val hub: HubClient) {
    suspend fun profile(): DeviceProfile = (hub.call(Call.GetProfile) as Reply.Profile).profile

    /** Live readings while collected; the TV stops measuring when the screen leaves. */
    fun metrics(): Flow<MetricsSnapshot> = hub.events.filterIsInstance<Push.Metrics>().map { it.snapshot }
        .onStart { hub.call(Call.WatchMetrics(true)) }
        .onCompletion { runCatching { hub.call(Call.WatchMetrics(false)) } }
}

class RemoteFiles(private val hub: HubClient) {
    suspend fun roots(): List<FileRoot> = (hub.call(Call.ListRoots) as Reply.Roots).roots
    suspend fun list(dir: RemotePath): List<FileEntry> = (hub.call(Call.ListDir(dir)) as Reply.Dir).entries
    suspend fun mkdir(p: RemotePath) = hub.call(Call.MakeDir(p))
    suspend fun rename(p: RemotePath, name: String) = hub.call(Call.Rename(p, name))
    suspend fun delete(ps: List<RemotePath>) = hub.call(Call.Delete(ps))
    suspend fun copy(ps: List<RemotePath>, dest: RemotePath) = hub.call(Call.Copy(ps, dest), 120_000)
    suspend fun move(ps: List<RemotePath>, dest: RemotePath) = hub.call(Call.Move(ps, dest), 120_000)

    /** Sends a stream to the TV in 256 KiB chunks on the bulk channel. */
    suspend fun upload(input: InputStream, size: Long, dest: RemotePath, overwrite: Boolean = false, onProgress: (Float) -> Unit = {}) {
        val id = (hub.bulk(Call.UploadBegin(dest, size, overwrite)) as Reply.Transfer).transferId
        try {
            val buf = ByteArray(CHUNK)
            var offset = 0L
            input.use {
                while (true) {
                    val n = it.readNBytesCompat(buf)
                    if (n <= 0) break
                    hub.bulk(Call.UploadChunk(id, offset, buf.copyOf(n)))
                    offset += n
                    onProgress(if (size > 0) offset.toFloat() / size else 1f)
                }
            }
            hub.bulk(Call.UploadCommit(id))
        } catch (e: Exception) {
            runCatching { hub.bulk(Call.TransferAbort(id)) }
            throw e
        }
    }

    suspend fun download(path: RemotePath, out: OutputStream, onProgress: (Float) -> Unit = {}) {
        val t = hub.bulk(Call.DownloadBegin(path)) as Reply.Transfer
        var offset = 0L
        out.use {
            while (true) {
                val chunk = hub.bulk(Call.DownloadChunk(t.transferId, offset, CHUNK)) as Reply.Bytes
                it.write(chunk.data); offset += chunk.data.size
                onProgress(if (t.size > 0) offset.toFloat() / t.size else 1f)
                if (chunk.eof || chunk.data.isEmpty()) break
            }
        }
    }

    companion object { const val CHUNK = 256 * 1024 }
}

class RemoteApps(private val hub: HubClient) {
    suspend fun list(): List<AppInfo> = (hub.call(Call.ListApps) as Reply.Apps).apps
    suspend fun icon(pkg: String, sizePx: Int): ByteArray = (hub.call(Call.AppIcon(pkg, sizePx)) as Reply.Bytes).data
    suspend fun launch(pkg: String) = hub.call(Call.LaunchApp(pkg))
    suspend fun uninstall(pkg: String) = hub.call(Call.UninstallApp(pkg))

    /**
     * Installs an app made of [splits] (base first) on the TV. Returns once the TV reports success;
     * the person at the TV confirms Android's install prompt in between.
     */
    suspend fun install(label: String, splits: List<Pair<Long, () -> InputStream>>, onProgress: (Float) -> Unit = {}): InstallState {
        val total = splits.sumOf { it.first }
        val id = (hub.bulk(Call.InstallBegin(label, splits.map { it.first })) as Reply.Transfer).transferId
        var sent = 0L
        splits.forEachIndexed { index, (_, open) ->
            var offset = 0L
            val buf = ByteArray(RemoteFiles.CHUNK)
            open().use { input ->
                while (true) {
                    val n = input.readNBytesCompat(buf)
                    if (n <= 0) break
                    hub.bulk(Call.InstallChunk(id, index, offset, buf.copyOf(n)))
                    offset += n; sent += n
                    onProgress(sent.toFloat() / total)
                }
            }
        }
        val done = coroutineScope {
            val result = async {
                hub.events.filterIsInstance<Push.InstallProgress>().first { it.transferId == id && (it.state == InstallState.SUCCESS || it.state == InstallState.FAILED) }
            }
            hub.bulk(Call.InstallCommit(id))
            // Generous: someone has to walk to the TV and confirm Android's prompt.
            withTimeoutOrNull(INSTALL_ANSWER_MILLIS) { result.await() }
                ?: run { result.cancel(); throw RemoteException(ErrorCode.TIMEOUT, "the TV did not confirm the install") }
        }
        if (done.state == InstallState.FAILED) throw RemoteException(ErrorCode.FAILED, done.message.ifEmpty { "install failed" })
        return done.state
    }
}

private const val INSTALL_ANSWER_MILLIS = 5 * 60_000L

class RemoteShell(private val hub: HubClient) {
    suspend fun run(backend: ShellBackend, command: String, timeoutMillis: Long = 30_000): CommandResult =
        (hub.call(Call.RunCommand(backend, command, timeoutMillis), timeoutMillis + 5_000) as Reply.Command).result
}

class RemoteServices(private val hub: HubClient) {
    suspend fun list(): List<ServiceEntry> = (hub.call(Call.ListServices, 40_000) as Reply.Services).services
    suspend fun save(spec: ServiceSpec) = hub.call(Call.SaveService(spec))
    suspend fun remove(id: String) = hub.call(Call.RemoveService(id))
    suspend fun control(id: String, action: ServiceAction) = hub.call(Call.ControlService(id, action), 40_000)
    suspend fun logs(id: String, lines: Int = 200): List<String> = (hub.call(Call.ServiceLogs(id, lines), 40_000) as Reply.Logs).lines
}

/** InputStream.readNBytes(byte[]) is API 33; fill the buffer the portable way. */
internal fun InputStream.readNBytesCompat(buf: ByteArray): Int {
    var total = 0
    while (total < buf.size) {
        val n = read(buf, total, buf.size - total)
        if (n < 0) break
        total += n
    }
    return total
}
