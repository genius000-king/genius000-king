package io.nawah.linux.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import io.nawah.linux.NawahApplication
import io.nawah.linux.R
import io.nawah.linux.core.provision.InstallProgress
import io.nawah.linux.core.provision.InstallRequest
import io.nawah.linux.core.provision.InstallStep
import android.util.Log
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.plus
import kotlinx.coroutines.Dispatchers

/**
 * Runs one machine installation to completion.
 *
 * This is a foreground service and not a coroutine in a ViewModel because the
 * work is ten to twenty-five minutes of downloading, extracting and `apt`, and
 * the user will certainly leave the app during it. Anything less and Android
 * reclaims the process mid-`dpkg`, which leaves a rootfs that is neither
 * installed nor removable.
 */
class InstallService : Service() {

    /**
     * The handler is not belt-and-braces; it is the difference between a bug
     * and a crash.
     *
     * Anything thrown out of the install flow lands in `collect`, and an
     * exception escaping a launched coroutine with no handler takes the whole
     * process down — which is what the user saw as "the app closed by itself",
     * twenty minutes into an install. With a handler it becomes a Failed state
     * on the screen, and the machine keeps its checkpoint.
     */
    private val crashGuard = CoroutineExceptionHandler { _, error ->
        Log.e(TAG, "install failed", error)
        val at = (progress.value as? InstallProgress.Running)?.step
            ?: InstallStep.ordered.first()
        progress.value = InstallProgress.Failed(
            at,
            error.message ?: error::class.java.simpleName,
            error.stackTraceToString().take(4_000),
        )
        stopSelf()
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + crashGuard)
    private var job: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notifications.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CANCEL -> {
                // Publish a terminal state from *here*, not from inside the
                // cancelled flow: once a coroutine is cancelled its `emit`
                // throws, so a Failed emitted down there never arrives and the
                // screen keeps rendering the last progress frame it saw. That
                // is what "the Cancel button does nothing" looked like.
                val at = (progress.value as? InstallProgress.Running)?.step
                    ?: InstallStep.ordered.first()
                job?.cancel()
                progress.value = InstallProgress.Failed(
                    at, getString(R.string.install_cancelled), "",
                )
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val services = (application as NawahApplication).services
        val resumeId = intent?.takeIf { it.action == ACTION_RESUME }
            ?.getStringExtra(EXTRA_MACHINE_ID)

        val flow = if (resumeId != null) {
            services.provisioner.resume(resumeId)
                ?: return START_NOT_STICKY.also { stopSelf() }
        } else {
            val request = intent?.let { InstallRequestCodec.decode(it) }
                ?: return START_NOT_STICKY.also { stopSelf() }
            services.provisioner.install(request)
        }
        val label = resumeId?.let { services.machineStore.get(it)?.name }
            ?: intent?.let { InstallRequestCodec.decode(it) }?.name
            ?: getString(R.string.app_name)

        if (job?.isActive == true) return START_NOT_STICKY

        startForegroundCompat(
            Notifications.install(
                this,
                getString(R.string.install_preparing),
                label,
                null,
            ),
        )

        // Cleared here rather than when the previous install ended: a terminal
        // state has to survive until the user has seen it.
        progress.value = null
        job = scope.launch {
            flow.collect { update ->
                progress.value = update
                when (update) {
                    is InstallProgress.Running -> notify(
                        title = update.step.label,
                        text = update.line ?: label,
                        percent = update.fraction?.let { (it * 100).toInt() },
                    )

                    is InstallProgress.Done -> {
                        notify(update.machine.name, getString(R.string.state_ready), 100, force = true)
                        stopSelf()
                    }

                    is InstallProgress.Failed -> {
                        notify(label, update.message, null, force = true)
                        stopSelf()
                    }
                }
            }
        }
        // Not START_STICKY: a restarted service would have lost the request and
        // would silently do nothing. A killed install is resumed explicitly by
        // the user, from a machine that is recorded as FAILED.
        return START_NOT_STICKY
    }

    private var lastNotifyAt = 0L

    /**
     * Rate-limited on purpose. `apt` emits thousands of lines, and posting a
     * notification for each one builds thousands of PendingIntents and pushes
     * the system's notification limit — which is a good way to have the process
     * killed in the middle of an install.
     */
    private fun notify(title: String, text: String, percent: Int?, force: Boolean = false) {
        val now = android.os.SystemClock.elapsedRealtime()
        if (!force && now - lastNotifyAt < NOTIFY_INTERVAL_MS) return
        lastNotifyAt = now
        val manager = getSystemService(android.app.NotificationManager::class.java)
        manager.notify(Notifications.ID_INSTALL, Notifications.install(this, title, text, percent))
    }

    private fun startForegroundCompat(notification: android.app.Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                Notifications.ID_INSTALL,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            startForeground(Notifications.ID_INSTALL, notification)
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "NawahInstall"
        const val ACTION_CANCEL = "io.nawah.linux.action.CANCEL_INSTALL"
        const val ACTION_RESUME = "io.nawah.linux.action.RESUME_INSTALL"
        const val EXTRA_MACHINE_ID = "io.nawah.linux.extra.MACHINE_ID"

        /** At most one notification per second, however fast the log scrolls. */
        private const val NOTIFY_INTERVAL_MS = 1_000L

        /**
         * Progress of the install currently in flight, or null when idle.
         * A process-wide value rather than a bound-service callback: the UI may
         * be destroyed and recreated many times during a single install.
         */
        val progress: MutableStateFlow<InstallProgress?> = MutableStateFlow(null)
        val current: StateFlow<InstallProgress?> get() = progress

        fun start(context: Context, request: InstallRequest) {
            val intent = Intent(context, InstallService::class.java)
            InstallRequestCodec.encode(intent, request)
            context.startForegroundService(intent)
        }

        /** Continues an interrupted install from its last completed step. */
        fun resume(context: Context, machineId: String) {
            context.startForegroundService(
                Intent(context, InstallService::class.java)
                    .setAction(ACTION_RESUME)
                    .putExtra(EXTRA_MACHINE_ID, machineId),
            )
        }

        fun cancel(context: Context) {
            context.startService(
                Intent(context, InstallService::class.java).setAction(ACTION_CANCEL),
            )
        }
    }
}
