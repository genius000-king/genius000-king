package com.genius.tvhub.runtime.host

import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.HostStatus
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.core.protocol.Domain
import com.genius.tvhub.core.protocol.EditAction
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import com.genius.tvhub.core.protocol.Reply
import com.genius.tvhub.core.protocol.ServiceAction
import com.genius.tvhub.core.protocol.ServiceEntry
import com.genius.tvhub.core.transport.CallHandler
import com.genius.tvhub.engine.input.api.EditKind
import com.genius.tvhub.engine.input.api.InputResult

/**
 * Every call from a phone passes here: first the permission gate (the phone's grants, read live
 * so a switch flipped on the TV applies to the very next call), then the engine that answers it.
 * Pure routing; no Android.
 */
class CallRouter(
    private val ports: HostPorts,
    private val grants: () -> Grants,
    private val status: () -> HostStatus,
    private val clock: () -> Long = System::currentTimeMillis,
) : CallHandler {

    override suspend fun handle(call: Call): Reply {
        requireGrant(call.domain)
        return when (call) {
            is Call.Ping -> Reply.Pong(call.sentAt, clock())
            Call.GetStatus -> Reply.Status(status())

            is Call.Key -> input { ports.input.key(call.action) }
            is Call.Tap -> input { ports.input.tap(call.at) }
            is Call.LongPress -> input { ports.input.longPress(call.at) }
            is Call.Swipe -> input { ports.input.swipe(call.points, call.durationMillis) }
            is Call.Text -> input { ports.input.text(call.text, call.mode) }
            is Call.Edit -> input { ports.input.edit(when (call.action) { EditAction.BACKSPACE -> EditKind.BACKSPACE; EditAction.ENTER -> EditKind.ENTER; EditAction.CLEAR -> EditKind.CLEAR }) }
            is Call.CursorMove -> input { ports.input.cursorMove(call.dx, call.dy) }
            is Call.CursorClick -> input { ports.input.cursorClick(call.long) }
            is Call.CursorScroll -> input { ports.input.cursorScroll(call.dx, call.dy) }
            is Call.CursorVisible -> input { ports.input.cursorVisible(call.visible) }

            Call.GetProfile -> Reply.Profile(ports.monitor.profile())
            is Call.WatchMetrics -> Reply.Ok // the session owns the subscription; see HostSession

            Call.ListRoots -> Reply.Roots(ports.files.roots())
            is Call.ListDir -> Reply.Dir(ports.files.list(call.path))
            is Call.MakeDir -> ok { ports.files.mkdir(call.path) }
            is Call.Rename -> ok { ports.files.rename(call.path, call.newName) }
            is Call.Delete -> ok { ports.files.delete(call.paths) }
            is Call.Copy -> ok { ports.files.copy(call.sources, call.destDir) }
            is Call.Move -> ok { ports.files.move(call.sources, call.destDir) }
            is Call.UploadBegin -> Reply.Transfer(ports.files.beginUpload(call.path, call.size, call.overwrite), call.size)
            is Call.UploadChunk -> ok { ports.files.writeChunk(call.transferId, call.offset, call.data) }
            is Call.UploadCommit -> ok { ports.files.commit(call.transferId) }
            is Call.DownloadBegin -> ports.files.beginDownload(call.path).let { (id, size) -> Reply.Transfer(id, size) }
            is Call.DownloadChunk -> ports.files.readChunk(call.transferId, call.offset, call.maxBytes).let { (data, eof) -> Reply.Bytes(data, eof) }
            is Call.TransferAbort -> ok { ports.files.end(call.transferId); ports.apps.abortInstall(call.transferId) }

            Call.ListApps -> Reply.Apps(ports.apps.list())
            is Call.AppIcon -> ports.apps.icon(call.packageName, call.sizePx)?.let { Reply.Bytes(it.png, eof = true) } ?: throw RemoteException(ErrorCode.NOT_FOUND, "no icon")
            is Call.LaunchApp -> if (ports.apps.launch(call.packageName)) Reply.Ok else throw RemoteException(ErrorCode.NOT_FOUND, "cannot open ${call.packageName}")
            is Call.UninstallApp -> ok { ports.apps.uninstall(call.packageName) }
            is Call.InstallBegin -> {
                if (!ports.apps.canInstall()) { ports.apps.requestInstallPermission(); throw RemoteException(ErrorCode.UNAVAILABLE, "allow TV Hub to install apps on the TV, then try again") }
                Reply.Transfer(ports.apps.beginInstall(call.label, call.splitSizes), call.splitSizes.sum())
            }
            is Call.InstallChunk -> ok { ports.apps.writeInstall(call.transferId, call.split, call.offset, call.data) }
            is Call.InstallCommit -> Reply.Ok // progress streams as Push.InstallProgress; see HostSession

            is Call.RunCommand -> Reply.Command(ports.shell.run(call.backend, call.command, call.timeoutMillis.coerceIn(1_000, 300_000)))
            Call.ListServices -> Reply.Services(ports.services.list().map { (s, st) -> ServiceEntry(s, st) })
            is Call.SaveService -> ok { ports.services.save(call.spec) }
            is Call.RemoveService -> ok { ports.services.remove(call.id) }
            is Call.ControlService -> ok {
                when (call.action) { ServiceAction.START -> ports.services.start(call.id); ServiceAction.STOP -> ports.services.stop(call.id); ServiceAction.RESTART -> ports.services.restart(call.id) }
            }
            is Call.ServiceLogs -> Reply.Logs(ports.services.logs(call.id, call.lines))

            is Call.SetStreamQuality -> ok { ports.stream.setQuality(call.quality) }
            Call.RequestKeyFrame -> ok { ports.stream.requestKeyFrame() }
        }
    }

    private fun requireGrant(domain: Domain) {
        val needed = when (domain) {
            Domain.SESSION -> return
            Domain.INPUT -> Grant.INPUT
            Domain.SCREEN -> Grant.SCREEN
            Domain.SYSTEM_INFO -> Grant.SYSTEM_INFO
            Domain.FILES_READ -> Grant.FILES_READ
            Domain.FILES_WRITE -> Grant.FILES_WRITE
            Domain.APPS -> Grant.APPS
            Domain.SHELL -> Grant.SHELL
            Domain.SERVICES -> Grant.SERVICES
        }
        if (needed !in grants()) throw RemoteException(ErrorCode.DENIED, "turn on \"${needed.name.lowercase()}\" for this phone on the TV")
    }

    private suspend fun input(block: suspend () -> InputResult): Reply = when (val r = block()) {
        InputResult.Done -> Reply.Ok
        InputResult.NotReady -> throw RemoteException(ErrorCode.UNAVAILABLE, "turn on TV Hub in the TV's accessibility settings")
        is InputResult.Unsupported -> throw RemoteException(ErrorCode.UNAVAILABLE, r.why)
        is InputResult.Failed -> throw RemoteException(ErrorCode.FAILED, r.why)
    }

    private inline fun ok(block: () -> Unit): Reply { block(); return Reply.Ok }
}
