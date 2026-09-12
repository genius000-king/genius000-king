package io.nawah.linux.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import io.nawah.linux.NawahApplication
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.launch
import kotlinx.coroutines.plus

/**
 * Holds a running machine: the proot process tree, and with it the X session.
 *
 * The desktop is not drawn here -- that is `com.termux.x11.MainActivity`, which
 * the user can leave and come back to freely. This service exists so that
 * leaving it does not kill the operating system behind it.
 */
class SessionService : Service() {

    // A session that dies badly stops the session, not the app.
    private val crashGuard = CoroutineExceptionHandler { _, error ->
        Log.e(TAG, "session failed", error)
        running.value = null
        stopSelf()
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + crashGuard)
    private var job: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Notifications.ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val machineId = intent?.getStringExtra(EXTRA_MACHINE_ID)
        when (intent?.action) {
            ACTION_STOP -> {
                stopSession()
                return START_NOT_STICKY
            }
        }
        if (machineId == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (running.value == machineId) {
            // Already up: just bring the display forward.
            services().sessionLauncher.openDisplay()
            return START_NOT_STICKY
        }

        val services = services()
        val machine = services.machineStore.machines.value.firstOrNull { it.id == machineId }
        if (machine == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundCompat(
            Notifications.session(this, machine.name, stopPendingIntent()),
        )
        acquireWakeLock()
        running.value = machineId

        job = scope.launch {
            services.sessionLauncher.start(machine)
                .catch { t -> Log.e(TAG, "session for ${machine.id} failed", t) }
                .onCompletion { running.value = null }
                .collect { line -> Log.d(TAG, line) }
            stopSelf()
        }

        // The X server surface lives in its own activity; bring it up now. The
        // guest side re-broadcasts its Binder once a second until this activity
        // answers, so the two halves do not need to be sequenced.
        services.sessionLauncher.openDisplay()
        return START_NOT_STICKY
    }

    private fun stopSession() {
        // Cancelling the flow destroys the proot process, and `--kill-on-exit`
        // takes the whole guest process tree down with it -- which is why that
        // flag is not optional in ProotArgsBuilder.
        job?.cancel()
        job = null
        running.value = null
        stopSelf()
    }

    private fun services() = (application as NawahApplication).services

    private fun stopPendingIntent(): PendingIntent = PendingIntent.getService(
        this,
        0,
        Intent(this, SessionService::class.java).setAction(ACTION_STOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun acquireWakeLock() {
        if (wakeLock != null) return
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nawah:session").apply {
            setReferenceCounted(false)
            acquire(SESSION_WAKELOCK_TIMEOUT_MS)
        }
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                Notifications.ID_SESSION,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(Notifications.ID_SESSION, notification)
        }
    }

    override fun onDestroy() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        scope.cancel()
        running.value = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "NawahSession"
        private const val EXTRA_MACHINE_ID = "io.nawah.linux.extra.MACHINE_ID"
        const val ACTION_STOP = "io.nawah.linux.action.STOP_SESSION"

        /** Eight hours; renewed on user interaction rather than held forever. */
        private const val SESSION_WAKELOCK_TIMEOUT_MS = 8L * 60 * 60 * 1000

        /** Id of the machine currently running, or null. */
        val running = MutableStateFlow<String?>(null)

        fun start(context: Context, machineId: String) {
            context.startForegroundService(
                Intent(context, SessionService::class.java)
                    .putExtra(EXTRA_MACHINE_ID, machineId),
            )
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, SessionService::class.java).setAction(ACTION_STOP),
            )
        }
    }
}
