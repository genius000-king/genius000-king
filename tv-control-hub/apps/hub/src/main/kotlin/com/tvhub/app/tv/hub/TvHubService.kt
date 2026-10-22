package com.tvhub.app.tv.hub

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import com.tvhub.common.LocalAddress
import com.tvhub.input.VideoPoint
import com.tvhub.input.tv.TvInputController
import com.tvhub.protocol.CONTROL_PORT
import com.tvhub.protocol.GlobalAction
import com.tvhub.protocol.IceCandidate
import com.tvhub.protocol.ProtocolMessage
import com.tvhub.protocol.SdpAnswer
import com.tvhub.protocol.Tap
import com.tvhub.stream.tv.ScreenStreamer
import com.tvhub.transport.tv.ControlListener
import com.tvhub.transport.tv.ControlServer
import com.tvhub.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Owns everything that must stay alive while the TV is shared: the control server, the screen capture,
 * and input injection. It runs as a foreground service of type mediaProjection.
 *
 * The consent intent is passed in by [start]. Android 14+ requires that the user grants capture first,
 * and that the service is in the foreground before the capture starts.
 */
class TvHubService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val connectedPeers = ConcurrentHashMap.newKeySet<String>()

    private lateinit var streamer: ScreenStreamer
    private lateinit var server: ControlServer

    private val listener = object : ControlListener {
        override fun onPeerConnected(peerId: String) {
            connectedPeers += peerId
            HubStatusStore.update { it.copy(viewers = connectedPeers.size) }
            if (streamer.isCapturing) streamer.openPeer(peerId)
        }

        override suspend fun onMessage(peerId: String, message: ProtocolMessage) {
            when (message) {
                is SdpAnswer -> streamer.onAnswer(peerId, message.sdp)
                is IceCandidate -> streamer.onRemoteCandidate(peerId, message)
                is Tap -> reportInput(TvInputController.tap(VideoPoint(message.x, message.y)), "tap")
                is GlobalAction -> reportInput(
                    TvInputController.navigate(message.action),
                    message.action.name,
                )
                else -> Unit
            }
        }

        override fun onPeerDisconnected(peerId: String) {
            connectedPeers -= peerId
            streamer.closePeer(peerId)
            HubStatusStore.update { it.copy(viewers = connectedPeers.size) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        streamer = ScreenStreamer(this) { peerId, message ->
            scope.launch { server.send(peerId, message) }
        }
        server = ControlServer(CONTROL_PORT, serverId = Build.MODEL, listener = listener)
        runCatching { server.start() }
            .onSuccess { HubStatusStore.update { it.copy(address = LocalAddress.ipv4(), isServing = true) } }
            .onFailure { failure ->
                HubStatusStore.update { it.copy(lastEvent = "فشل تشغيل الخادم: ${failure.message}") }
            }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()
        val consent = intent?.let { IntentCompat.getParcelableExtra(it, EXTRA_CONSENT, Intent::class.java) }
        if (consent != null) startCapture(consent)
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        streamer.dispose()
        server.stop()
        scope.cancel()
        HubStatusStore.update { HubStatus() }
        super.onDestroy()
    }

    private fun startAsForeground() {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.hub_notification_title))
            .setContentText(getString(R.string.hub_notification_text))
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setOngoing(true)
            .build()
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )
    }

    private fun startCapture(consent: Intent) {
        runCatching {
            streamer.startCapture(consent) {
                HubStatusStore.update { it.copy(isStreaming = false, lastEvent = "توقف البث من النظام") }
            }
        }.onFailure { failure ->
            HubStatusStore.update { it.copy(lastEvent = "تعذّر بدء البث: ${failure.message}") }
            return
        }
        connectedPeers.forEach { streamer.openPeer(it) }
        HubStatusStore.update { it.copy(isStreaming = true, lastEvent = "بدأ البث") }
    }

    private fun reportInput(delivered: Boolean, what: String) {
        if (!delivered) {
            HubStatusStore.update {
                it.copy(lastEvent = "لم يُنفَّذ $what: فعّل خدمة الإدخال في إمكانية الوصول")
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
            .setName(getString(R.string.hub_channel_name))
            .build()
        NotificationManagerCompat.from(this).createNotificationChannel(channel)
    }

    companion object {
        private const val EXTRA_CONSENT = "com.tvhub.app.tv.hub.EXTRA_CONSENT"
        private const val CHANNEL_ID = "tv_hub_streaming"
        private const val NOTIFICATION_ID = 1

        /** Starts the service with the MediaProjection consent. Call it only after the user has granted it. */
        fun start(context: Context, consent: Intent) {
            val intent = Intent(context, TvHubService::class.java).putExtra(EXTRA_CONSENT, consent)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TvHubService::class.java))
        }
    }
}
