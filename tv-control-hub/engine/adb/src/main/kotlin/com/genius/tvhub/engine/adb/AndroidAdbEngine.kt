package com.genius.tvhub.engine.adb

import android.content.Context
import android.os.Build
import android.view.WindowManager
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.engine.adb.agent.AgentClient
import com.genius.tvhub.engine.adb.api.AdbEngine
import com.genius.tvhub.engine.adb.api.AdbState
import com.genius.tvhub.engine.adb.api.AgentInput
import com.genius.tvhub.engine.adb.api.ShellOutput
import com.genius.tvhub.engine.adb.link.AdbLink
import com.genius.tvhub.engine.adb.screen.H264Unit
import com.genius.tvhub.engine.adb.screen.ScreenRecorder
import com.genius.tvhub.engine.adb.setup.SetupPlan
import com.genius.tvhub.engine.adb.setup.StepId
import dadb.AdbAuthException
import dadb.InstallResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.ConnectException
import java.net.SocketTimeoutException

/** [AdbEngine] on the TV itself, through dadb over loopback. */
class AndroidAdbEngine(private val context: Context) : AdbEngine {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val link = AdbLink(File(context.filesDir, "adb"))
    private val _state = MutableStateFlow<AdbState>(AdbState.Off)
    override val state: StateFlow<AdbState> = _state
    private var connecting: Job? = null

    init {
        // adbd restarts (network change, developer settings) silently drop the link: notice and reconnect.
        scope.launch {
            while (true) {
                delay(WATCH_MILLIS)
                if (_state.value != AdbState.Ready) continue
                val alive = runCatching { link.current()?.shell("true") != null }.getOrDefault(false)
                if (!alive) {
                    Log.w(TAG, "ADB link lost; reconnecting")
                    agent.stop()
                    link.close()
                    _state.value = AdbState.Connecting
                    connect()
                }
            }
        }
    }

    private val agent = AgentClient(context.applicationInfo.sourceDir, ::screenSize) { link.current() }
    override val input: AgentInput get() = agent
    private val recorder = ScreenRecorder { link.current() }

    override fun connect() {
        if (connecting?.isActive == true || _state.value == AdbState.Ready) return
        // (Connecting set by the watchdog still proceeds: no job is running then.)
        connecting = scope.launch {
            _state.value = AdbState.Connecting
            if (!link.portOpen()) { _state.value = AdbState.Unavailable(AdbState.Reason.PORT_CLOSED); return@launch }
            // The approval prompt is on screen while adbd waits: say so instead of "connecting".
            val prompt = launch { delay(1_500); if (_state.value == AdbState.Connecting) _state.value = AdbState.AwaitingApproval }
            _state.value = try {
                val opened = scope.async { link.open() }
                withTimeoutOrNull(APPROVAL_TIMEOUT_MILLIS) { opened.await() } ?: run {
                    link.close() // unblocks the waiting handshake
                    throw SocketTimeoutException("approval not given")
                }
                agent.warmUp()
                AdbState.Ready
            } catch (e: Exception) {
                link.close()
                Log.w(TAG, "ADB connect failed", e)
                AdbState.Unavailable(reasonOf(e))
            } finally {
                prompt.cancel()
            }
        }
    }

    override fun disconnect() {
        connecting?.cancel()
        agent.stop()
        link.close()
        _state.value = AdbState.Off
    }

    override fun screen(width: Int, height: Int, bitrate: Int): Flow<H264Unit> = recorder.units(width, height, bitrate)

    override fun requestKeyFrame() = recorder.refresh()

    override suspend fun install(apks: List<File>): String? = withContext(Dispatchers.IO) {
        val d = link.current() ?: return@withContext "ADB is not connected"
        // -r: replace an installed version; -g: grant runtime permissions, nothing to tap later.
        val result = runCatching { if (apks.size == 1) d.install(apks[0], "-r", "-g") else d.installMultiple(apks, "-r", "-g") }
        when (val r = result.getOrElse { return@withContext it.message ?: "install failed" }) {
            is InstallResult.Failure -> r.reason
            else -> null
        }
    }

    override suspend fun setup(takeHome: Boolean): List<StepId> {
        val pkg = context.packageName
        val service = "$pkg/com.genius.tvhub.engine.input.service.HubAccessibilityService"
        val current = shell("settings get secure enabled_accessibility_services").output.trim()
        val steps = SetupPlan.steps(pkg, service, current, homeAlias = if (takeHome) "$pkg/$pkg.TvHome" else null)
        return steps.filter { step ->
            val out = shell(step.command)
            val failed = out.exitCode != 0 || out.output.contains("Exception") || out.output.contains("Error:")
            if (failed) Log.w(TAG, "setup ${step.id} failed: ${out.output.take(200)}")
            failed
        }.map { it.id }
    }

    override suspend fun shell(command: String): ShellOutput = withContext(Dispatchers.IO) {
        val d = link.current() ?: return@withContext ShellOutput(-1, "ADB is not connected")
        runCatching { d.shell(command).let { ShellOutput(it.exitCode, it.allOutput) } }
            .getOrElse { ShellOutput(-1, it.message.orEmpty()) }
    }

    private fun screenSize(): Pair<Int, Int> = if (Build.VERSION.SDK_INT >= 30) {
        context.getSystemService(WindowManager::class.java).maximumWindowMetrics.bounds.let { it.width() to it.height() }
    } else context.resources.displayMetrics.let { it.widthPixels to it.heightPixels }

    private fun reasonOf(e: Throwable): AdbState.Reason = when {
        e is AdbAuthException || e is SocketTimeoutException || e.cause is SocketTimeoutException -> AdbState.Reason.NOT_APPROVED
        e is ConnectException || e.cause is ConnectException -> AdbState.Reason.PORT_CLOSED
        else -> AdbState.Reason.FAILED
    }

    private companion object {
        const val TAG = "AdbEngine"
        /** Long enough to walk to the TV, find the remote and press "Allow". */
        const val APPROVAL_TIMEOUT_MILLIS = 90_000L
        const val WATCH_MILLIS = 30_000L
    }
}
