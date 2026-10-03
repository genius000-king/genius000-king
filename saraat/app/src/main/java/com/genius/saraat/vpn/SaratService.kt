package com.genius.saraat.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.net.TrafficStats
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.genius.saraat.MainActivity
import com.genius.saraat.R
import com.genius.saraat.data.AppMode
import com.genius.saraat.data.Live
import com.genius.saraat.data.Prefs
import com.genius.saraat.data.Settings
import com.genius.saraat.data.Speed
import com.genius.saraat.data.UID_DEVICE
import com.genius.saraat.data.UsageDb
import com.genius.saraat.data.UsageRow
import com.genius.saraat.data.formatLimit
import com.genius.saraat.data.formatRate
import com.genius.saraat.engine.EngineConfig
import com.genius.saraat.engine.EngineLog
import com.genius.saraat.engine.Limiter
import com.genius.saraat.engine.SocketProtector
import com.genius.saraat.engine.TrafficSink
import com.genius.saraat.engine.TunEngine
import com.genius.saraat.engine.parseIpv4
import java.net.DatagramSocket
import java.net.Socket
import java.util.concurrent.Executors

/**
 * The one long-running piece of the app. It always does two jobs:
 *
 *  1. Monitoring: once a second it measures how much data moved and logs it per minute.
 *  2. Limiting (optional): when enabled it opens a VPN tunnel and runs the [TunEngine] in it.
 *
 * It is a foreground service so Android keeps it alive; its notification shows the live speed.
 */
class SaratService : VpnService() {
    private val handler = Handler(Looper.getMainLooper())
    private val dbExecutor = Executors.newSingleThreadExecutor()
    private val accumulator = Accumulator()
    private val pending = HashMap<Triple<Long, Int, Int>, LongArray>() // (minute, uid, net) -> [down, up]
    private val history = ArrayDeque<Speed>()
    private lateinit var networks: PhysicalNetworks

    private var engine: TunEngine? = null
    private var vpnSignature: String? = null
    private var stopping = false
    private var screenOn = true

    private var lastTickElapsed = 0L
    private var lastFlush = 0L
    private var lastPrune = 0L
    private var tickCount = 0
    private var baseRx = -1L
    private var baseTx = -1L
    private var baseMobileRx = 0L
    private var baseMobileTx = 0L

    private val ticker = object : Runnable {
        override fun run() {
            tick()
            handler.postDelayed(this, if (screenOn) 1_000 else 10_000)
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            screenOn = intent.action == Intent.ACTION_SCREEN_ON
            handler.removeCallbacks(ticker)
            handler.post(ticker)
        }
    }

    private val restartVpn = Runnable {
        val s = Prefs.current
        if (engine != null && s.limitEnabled && vpnSignature != signatureFor(s)) reconcile()
    }

    // ===========================================================================================
    // Service lifecycle
    // ===========================================================================================

    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        createChannel()
        networks = PhysicalNetworks(this) { handler.post(::onNetworkChanged) }
        networks.start()
        ContextCompat.registerReceiver(
            this, screenReceiver,
            IntentFilter(Intent.ACTION_SCREEN_ON).apply { addAction(Intent.ACTION_SCREEN_OFF) },
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        Live.serviceRunning.value = true
        lastTickElapsed = SystemClock.elapsedRealtime()
        handler.postDelayed(ticker, 1_000)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Must happen within seconds of startForegroundService().
        startForegroundCompat()
        when (intent?.action) {
            ACTION_STOP_LIMIT -> Prefs.update { copy(limitEnabled = false, timerEndsAt = 0) }
        }
        reconcile()
        return START_STICKY
    }

    override fun onRevoke() {
        // Another VPN took over or the user removed our permission. Keep monitoring if asked to.
        Prefs.update { copy(limitEnabled = false, timerEndsAt = 0) }
        Live.message.value = "تم سحب إذن الـVPN من سرعات، فتوقف التحديد."
        reconcile()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        stopVpn()
        runCatching { unregisterReceiver(screenReceiver) }
        networks.stop()
        flush(force = true)
        dbExecutor.shutdown()
        Live.serviceRunning.value = false
        Live.speed.value = Speed()
        super.onDestroy()
    }

    /** Brings the world in line with the current settings. Safe to call at any time. */
    private fun reconcile() {
        var s = Prefs.current
        if (s.limitEnabled && s.timerEndsAt > 0 && System.currentTimeMillis() >= s.timerEndsAt) {
            Prefs.update { copy(limitEnabled = false, timerEndsAt = 0) }
            s = Prefs.current
        }
        if (s.limitEnabled) {
            if (engine == null || vpnSignature != signatureFor(s)) {
                startVpn(s)
            } else {
                engine?.limiter?.setKbps(s.downKbps.toLong(), s.effectiveUpKbps.toLong())
            }
        } else {
            stopVpn()
        }
        val after = Prefs.current
        if (!after.limitEnabled && !after.keepLogging) {
            flush(force = true)
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        } else {
            notifyNow()
        }
    }

    // ===========================================================================================
    // The VPN tunnel
    // ===========================================================================================

    private fun signatureFor(s: Settings) =
        "${s.appMode}|${s.apps.sorted().joinToString(",")}|${s.blockQuic}|${networks.signature()}"

    private fun onNetworkChanged() {
        if (engine == null) return
        handler.removeCallbacks(restartVpn)
        handler.postDelayed(restartVpn, 800) // wait for Android to settle after a Wi-Fi <-> mobile switch
    }

    private fun startVpn(s: Settings) {
        stopVpn()
        if (!s.appsValid) return fail("اختر تطبيقًا واحدًا على الأقل ثم فعّل التحديد.")
        if (VpnService.prepare(this) != null) return fail("يحتاج سرعات إلى إذن الـVPN. افتح التطبيق وفعّل التحديد.")

        val network = networks.best()
        val dns = networks.dnsServers(network).ifEmpty { listOf("1.1.1.1", "8.8.8.8") }

        val builder = Builder()
            .setSession("سرعات")
            .setMtu(MTU)
            .addAddress(TUN_ADDRESS, 32)
            .addRoute("0.0.0.0", 0)
            .setBlocking(true)
            .setMetered(networks.isMetered(network))
            .setConfigureIntent(
                PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
            )
        dns.forEach { runCatching { builder.addDnsServer(it) } }

        // Our own app is always outside the tunnel: the engine's sockets must reach the real network.
        var applied = 0
        when (s.appMode) {
            AppMode.ALL, AppMode.EXCEPT -> {
                runCatching { builder.addDisallowedApplication(packageName) }
                if (s.appMode == AppMode.EXCEPT) {
                    s.apps.forEach { pkg -> if (runCatching { builder.addDisallowedApplication(pkg) }.isSuccess) applied++ }
                }
            }
            AppMode.ONLY -> s.apps.forEach { pkg -> if (runCatching { builder.addAllowedApplication(pkg) }.isSuccess) applied++ }
        }
        if (s.appMode == AppMode.ONLY && applied == 0) return fail("التطبيقات المحددة لم تعد موجودة على الجهاز.")

        val pfd = try {
            builder.establish()
        } catch (e: Exception) {
            Log.w(TAG, "establish failed", e)
            null
        } ?: return fail("تعذّر تشغيل الـVPN. أعد المحاولة.")
        if (network != null) runCatching { setUnderlyingNetworks(arrayOf(network)) }

        val clientIp = parseIpv4(TUN_ADDRESS)
        val e = TunEngine(
            tun = AndroidTun(pfd),
            config = EngineConfig(clientIp = clientIp, blockQuic = s.blockQuic),
            limiter = Limiter().apply { setKbps(s.downKbps.toLong(), s.effectiveUpKbps.toLong()) },
            protector = object : SocketProtector {
                override fun protect(socket: Socket) = this@SaratService.protect(socket)
                override fun protect(socket: DatagramSocket) = this@SaratService.protect(socket)
            },
            uids = UidLookup(this, clientIp),
            sink = accumulator,
            logger = EngineLog { Log.d(TAG, it) },
        )
        e.onStopped = { handler.post { if (engine === e && !stopping) onEngineDied() } }
        engine = e
        vpnSignature = signatureFor(s)
        resetBaselines()
        e.start()
        Live.vpnActive.value = true
        Live.message.value = null
    }

    private fun stopVpn() {
        val e = engine ?: return
        stopping = true
        collectEngineTraffic()
        engine = null
        vpnSignature = null
        e.stop()
        stopping = false
        Live.vpnActive.value = false
        resetBaselines()
    }

    private fun onEngineDied() {
        Live.message.value = "توقف التحديد بشكل غير متوقع."
        Prefs.update { copy(limitEnabled = false, timerEndsAt = 0) }
        reconcile()
    }

    private fun fail(message: String) {
        Live.message.value = message
        Prefs.update { copy(limitEnabled = false, timerEndsAt = 0) }
    }

    // ===========================================================================================
    // Monitoring and logging
    // ===========================================================================================

    private fun tick() {
        val nowElapsed = SystemClock.elapsedRealtime()
        val dtMs = nowElapsed - lastTickElapsed
        lastTickElapsed = nowElapsed
        val now = System.currentTimeMillis()

        var down = 0L
        var up = 0L
        if (engine != null) {
            val t = collectEngineTraffic()
            down = t.first
            up = t.second
        } else {
            val t = sampleDeviceTotals(now, dtMs)
            down = t.first
            up = t.second
        }

        if (dtMs > 0) {
            val speed = Speed(down * 1000 / dtMs, up * 1000 / dtMs)
            Live.speed.value = speed
            if (screenOn) {
                history.addLast(speed)
                while (history.size > 60) history.removeFirst()
                Live.history.value = history.toList()
            }
        }

        val s = Prefs.current
        if (s.limitEnabled && s.timerEndsAt > 0 && now >= s.timerEndsAt) reconcile()
        if (now - lastFlush > 15_000) flush(force = false)
        if (screenOn && ++tickCount % 2 == 0) notifyNow()
    }

    /** Moves bytes counted by the engine into the pending log. Returns (down, up) totals. */
    private fun collectEngineTraffic(): Pair<Long, Long> {
        val net = if (networks.isMobile()) 1 else 0
        val minute = System.currentTimeMillis() / 60_000
        var down = 0L
        var up = 0L
        for ((uid, v) in accumulator.drain()) {
            addPending(minute, uid, net, v[0], v[1])
            down += v[0]
            up += v[1]
        }
        return down to up
    }

    /** With no tunnel we can only see device totals (no per-app numbers) via TrafficStats. */
    private fun sampleDeviceTotals(now: Long, dtMs: Long): Pair<Long, Long> {
        val rx = TrafficStats.getTotalRxBytes()
        val tx = TrafficStats.getTotalTxBytes()
        if (rx == TrafficStats.UNSUPPORTED.toLong() || tx == TrafficStats.UNSUPPORTED.toLong()) return 0L to 0L
        val mrx = TrafficStats.getMobileRxBytes().coerceAtLeast(0)
        val mtx = TrafficStats.getMobileTxBytes().coerceAtLeast(0)
        var down = 0L
        var up = 0L
        if (baseRx >= 0) {
            val dRx = (rx - baseRx).coerceAtLeast(0)
            val dTx = (tx - baseTx).coerceAtLeast(0)
            val mDown = (mrx - baseMobileRx).coerceIn(0, dRx)
            val mUp = (mtx - baseMobileTx).coerceIn(0, dTx)
            addSpread(now, dtMs, 0, dRx - mDown, dTx - mUp)
            addSpread(now, dtMs, 1, mDown, mUp)
            down = dRx
            up = dTx
        }
        baseRx = rx
        baseTx = tx
        baseMobileRx = mrx
        baseMobileTx = mtx
        return down to up
    }

    /** If the phone slept between two ticks, spread the bytes over the minutes that really passed. */
    private fun addSpread(now: Long, dtMs: Long, net: Int, down: Long, up: Long) {
        if (down == 0L && up == 0L) return
        val minutes = (dtMs / 60_000).coerceIn(1, 180).toInt()
        val endMinute = now / 60_000
        for (i in 0 until minutes) {
            addPending(endMinute - i, UID_DEVICE, net, down / minutes, up / minutes)
        }
    }

    private fun addPending(minute: Long, uid: Int, net: Int, down: Long, up: Long) {
        if (down == 0L && up == 0L) return
        val a = pending.getOrPut(Triple(minute, uid, net)) { LongArray(2) }
        a[0] += down
        a[1] += up
    }

    private fun resetBaselines() {
        baseRx = -1
        baseTx = -1
    }

    private fun flush(force: Boolean) {
        lastFlush = System.currentTimeMillis()
        if (pending.isNotEmpty()) {
            val rows = pending.map { (k, v) -> UsageRow(k.first, k.second, k.third, v[0], v[1]) }
            pending.clear()
            val db = UsageDb.get(this)
            if (!dbExecutor.isShutdown) dbExecutor.execute { runCatching { db.add(rows) } }
        }
        val nowMinute = System.currentTimeMillis() / 60_000
        if (force || nowMinute - lastPrune > 60) {
            lastPrune = nowMinute
            val keepFrom = nowMinute - Prefs.current.retentionDays * 1440L
            val db = UsageDb.get(this)
            if (!dbExecutor.isShutdown) dbExecutor.execute { runCatching { db.prune(keepFrom) } }
        }
    }

    // ===========================================================================================
    // Notification
    // ===========================================================================================

    private fun createChannel() {
        val channel = NotificationChannel(CHANNEL_ID, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW)
        channel.setShowBadge(false)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val s = Prefs.current
        val active = engine != null
        val speed = Live.speed.value
        val title = if (active) "التحديد يعمل · ${formatLimit(s.downKbps)}" else "سرعات تراقب اتصالك"
        val text = "↓ ${formatRate(speed.down)}    ↑ ${formatRate(speed.up)}"
        val b = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_saraat)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setColor(0xFF1E6BFF.toInt())
            .setContentIntent(
                PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
            )
        if (active) {
            b.addAction(
                0, "إيقاف التحديد",
                PendingIntent.getService(
                    this, 1, Intent(this, SaratService::class.java).setAction(ACTION_STOP_LIMIT),
                    PendingIntent.FLAG_IMMUTABLE,
                ),
            )
        }
        return b.build()
    }

    private fun startForegroundCompat() {
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
    }

    private fun notifyNow() {
        val nm = getSystemService(NotificationManager::class.java)
        runCatching { nm.notify(NOTIFICATION_ID, buildNotification()) }
    }

    /** Thread-safe tally of bytes the engine reports; drained by the 1 s ticker. */
    private class Accumulator : TrafficSink {
        private val map = HashMap<Int, LongArray>()

        @Synchronized
        override fun onTraffic(uid: Int, downBytes: Long, upBytes: Long) {
            val a = map.getOrPut(uid) { LongArray(2) }
            a[0] += downBytes
            a[1] += upBytes
        }

        @Synchronized
        fun drain(): Map<Int, LongArray> {
            val copy = HashMap(map)
            map.clear()
            return copy
        }
    }

    companion object {
        private const val TAG = "Saraat"
        private const val CHANNEL_ID = "saraat_status"
        private const val NOTIFICATION_ID = 1
        private const val MTU = 1500
        const val TUN_ADDRESS = "10.1.10.1"
        const val ACTION_APPLY = "com.genius.saraat.APPLY"
        const val ACTION_STOP_LIMIT = "com.genius.saraat.STOP_LIMIT"

        /** Starts the service (if needed) and makes it re-read the settings. */
        fun apply(context: Context) {
            val intent = Intent(context, SaratService::class.java).setAction(ACTION_APPLY)
            ContextCompat.startForegroundService(context, intent)
        }

        fun hasVpnPermission(context: Context): Boolean = VpnService.prepare(context) == null
    }
}
