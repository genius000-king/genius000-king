package com.genius.tvhub.runtime.host

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.genius.tvhub.core.common.Log
import com.genius.tvhub.engine.stream.StreamEngine
import com.genius.tvhub.engine.stream.capture.ProjectionConsentActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Keeps the TV side running: a foreground service of type connectedDevice, promoted to
 * mediaProjection only while a phone watches the screen (an Android 14 rule). Shows the pairing
 * prompt when a new phone asks.
 */
@AndroidEntryPoint
class HostService : LifecycleService() {
    @Inject lateinit var runtime: HostRuntime
    @Inject lateinit var stream: StreamEngine

    override fun onCreate() {
        super.onCreate()
        promote(projection = false)
        runtime.projectionRequester = ::requestProjection
        lifecycleScope.launch { runtime.start(lifecycleScope) }
        lifecycleScope.launch {
            runtime.gatekeeper.request.collect { r ->
                if (r != null) runCatching {
                    startActivity(Intent(ACTION_APPROVE).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
                }.onFailure { Log.w(TAG, "could not show the pairing prompt", it) }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        return START_STICKY
    }

    override fun onDestroy() {
        lifecycleScope.launch { runtime.stop() }
        stream.projection.release()
        super.onDestroy()
    }

    private suspend fun requestProjection(): Boolean {
        val consent = ProjectionConsentActivity.request(this) ?: return false
        promote(projection = true)
        stream.projection.acquire(consent.resultCode, consent.data)
        return stream.projection.active.value
    }

    private fun promote(projection: Boolean) {
        val type = if (Build.VERSION.SDK_INT >= 29) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE or (if (projection) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0)
        } else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), type)
    }

    private fun notification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.host_channel), NotificationManager.IMPORTANCE_MIN))
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle(getString(R.string.host_running))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    companion object {
        private const val TAG = "HostService"
        private const val CHANNEL = "host"
        private const val NOTIFICATION_ID = 1
        const val ACTION_APPROVE = "com.genius.tvhub.action.APPROVE_PAIRING"

        fun start(context: Context) = ContextCompat.startForegroundService(context, Intent(context, HostService::class.java))
    }
}
