package com.genius.saraat.engine

import java.io.IOException
import java.nio.channels.DatagramChannel
import java.nio.channels.SelectionKey
import java.nio.channels.Selector
import java.nio.channels.SocketChannel
import java.util.ArrayDeque
import java.util.concurrent.ArrayBlockingQueue

/**
 * Userspace network stack that sits behind a TUN device and enforces a bandwidth limit.
 *
 * Packets the apps send arrive on the TUN. TCP connections are terminated by [TcpSession] and
 * re-opened as real sockets; UDP flows are relayed through connected datagram sockets. Whatever
 * crosses those real sockets is metered by two shared [TokenBucket]s (down / up).
 *
 * Threading: one thread blocks on the TUN and only enqueues raw packets; ALL state lives on the
 * "engine" thread, which multiplexes sockets with a [Selector]. That means no locks anywhere.
 */
class TunEngine(
    private val tun: TunPort,
    private val config: EngineConfig,
    val limiter: Limiter,
    private val protector: SocketProtector = SocketProtector.None,
    private val uids: UidResolver = UidResolver.None,
    private val sink: TrafficSink = TrafficSink { _, _, _ -> },
    private val remotes: RemoteResolver = RemoteResolver.Direct,
    private val logger: EngineLog = EngineLog.None,
) {
    /** Called once on the engine thread when the engine ends (TUN closed or fatal error). */
    @Volatile
    var onStopped: (() -> Unit)? = null

    @Volatile
    private var running = false

    @Volatile
    private var sleeping = false

    private val selector: Selector = Selector.open()
    private val inbox = ArrayBlockingQueue<ByteArray>(4096)
    private val writer = PacketWriter(tun)

    private val tcp = HashMap<Long, TcpSession>()
    private val udp = HashMap<Long, UdpSession>()

    // Sessions waiting for tokens to move data. Limited sessions share the buckets, exempt ones don't.
    private val downQueue = ArrayDeque<TcpSession>()
    private val downFree = ArrayDeque<TcpSession>()
    private val upQueue = ArrayDeque<TcpSession>()
    private val upFree = ArrayDeque<TcpSession>()

    private class UdpPacket(val session: UdpSession, val data: ByteArray)

    private val udpUp = ArrayDeque<UdpPacket>()
    private val udpDown = ArrayDeque<UdpPacket>()
    private var udpUpBytes = 0
    private var udpDownBytes = 0

    private val pendingTraffic = HashMap<Int, LongArray>()
    private val scratchBuf = ByteArray(TcpSession.MAX_MSS)

    private var engineThread: Thread? = null
    private var readerThread: Thread? = null

    private val host = object : EngineHost {
        override val writer: PacketWriter get() = this@TunEngine.writer
        override val clientIp: Int get() = config.clientIp
        override val scratch: ByteArray get() = scratchBuf
        override fun now() = System.nanoTime()

        override fun queueDownload(s: TcpSession) {
            if (s.inDownQueue) return
            s.inDownQueue = true
            (if (s.exempt) downFree else downQueue).addLast(s)
        }

        override fun queueUpload(s: TcpSession) {
            if (s.inUpQueue) return
            s.inUpQueue = true
            (if (s.exempt) upFree else upQueue).addLast(s)
        }

        override fun account(uid: Int, down: Int, up: Int) {
            val a = pendingTraffic.getOrPut(uid) { LongArray(2) }
            a[0] += down.toLong()
            a[1] += up.toLong()
        }

        override fun sessionClosed(s: TcpSession) {
            if (tcp[s.key] === s) tcp.remove(s.key)
        }
    }

    // ===========================================================================================
    // Lifecycle
    // ===========================================================================================

    fun start() {
        check(!running) { "already started" }
        running = true
        engineThread = Thread(::loop, "saraat-engine").also { it.start() }
        readerThread = Thread(::readLoop, "saraat-tun-reader").also {
            it.isDaemon = true
            it.start()
        }
    }

    /** Stops the engine and closes the TUN. Blocks briefly until the engine thread is done. */
    fun stop() {
        running = false
        selector.wakeup()
        try {
            tun.close()
        } catch (_: Exception) {
        }
        readerThread?.interrupt()
        val t = engineThread
        if (t != null && t !== Thread.currentThread()) t.join(3000)
    }

    /** Thread 1: the only job is to move packets off the (blocking) TUN and hand them to the engine thread. */
    private fun readLoop() {
        val buf = ByteArray(MAX_PACKET)
        try {
            while (running) {
                val n = tun.read(buf)
                if (n < 0) break
                if (n == 0) continue
                inbox.put(buf.copyOf(n))
                if (sleeping) selector.wakeup()
            }
        } catch (_: InterruptedException) {
        } catch (e: IOException) {
            if (running) logger.log("tun read failed: $e")
        } finally {
            running = false
            selector.wakeup()
        }
    }

    /** Thread 2: everything else. */
    private fun loop() {
        var lastTick = System.nanoTime()
        try {
            while (running) {
                val timeoutMs = nextTimeoutMs(System.nanoTime())
                sleeping = true
                try {
                    if (timeoutMs <= 0 || inbox.isNotEmpty()) selector.selectNow() else selector.select(timeoutMs)
                } finally {
                    sleeping = false
                }
                if (!running) break
                dispatchSelected()
                drainInbox()
                val now = System.nanoTime()
                pump(now)
                if (now - lastTick >= TICK_NANOS) {
                    lastTick = now
                    housekeeping(now)
                }
            }
        } catch (t: Throwable) {
            logger.log("engine crashed: ${t.stackTraceToString()}")
        } finally {
            running = false
            shutdown()
            onStopped?.invoke()
        }
    }

    private fun shutdown() {
        for (s in tcp.values.toTypedArray()) s.closeChannel()
        for (s in udp.values.toTypedArray()) s.close()
        tcp.clear()
        udp.clear()
        flushTraffic()
        try {
            selector.close()
        } catch (_: IOException) {
        }
    }

    // ===========================================================================================
    // Event loop pieces
    // ===========================================================================================

    private fun dispatchSelected() {
        val it = selector.selectedKeys().iterator()
        while (it.hasNext()) {
            val key = it.next()
            it.remove()
            when (val owner = key.attachment()) {
                is TcpSession -> owner.onSelected(key)
                is UdpSession -> owner.onSelected(key, System.nanoTime())
            }
        }
    }

    private fun drainInbox() {
        var n = 0
        while (n++ < INBOX_BATCH) {
            val p = inbox.poll() ?: return
            handlePacket(p)
        }
    }

    /** How long the selector may sleep: until the next token refill we are waiting for, or the housekeeping tick. */
    private fun nextTimeoutMs(now: Long): Long {
        if (inbox.isNotEmpty() || downFree.isNotEmpty() || upFree.isNotEmpty()) return 0
        // Wake rarely when nothing is connected: this loop runs inside a battery-powered phone.
        var waitNanos = if (tcp.isEmpty() && udp.isEmpty()) IDLE_TICK_NANOS else TICK_NANOS
        if (downQueue.isNotEmpty()) {
            val n = limiter.down.nanosUntil(MIN_CHUNK.toLong(), now)
            if (n <= 0) return 0
            waitNanos = minOf(waitNanos, n)
        }
        upQueue.peekFirst()?.let { s ->
            val n = limiter.up.nanosUntil(minOf(MIN_CHUNK, maxOf(1, s.pendingUpload)).toLong(), now)
            if (n <= 0) return 0
            waitNanos = minOf(waitNanos, n)
        }
        udpUp.peekFirst()?.let {
            val n = limiter.up.nanosUntil(it.data.size.toLong(), now)
            if (n <= 0) return 0
            waitNanos = minOf(waitNanos, n)
        }
        udpDown.peekFirst()?.let {
            val n = limiter.down.nanosUntil(it.data.size.toLong(), now)
            if (n <= 0) return 0
            waitNanos = minOf(waitNanos, n)
        }
        return maxOf(1L, (waitNanos + 999_999) / 1_000_000)
    }

    private fun housekeeping(now: Long) {
        for (s in tcp.values.toTypedArray()) s.tick(now)
        for (s in udp.values.toTypedArray()) {
            if (now - s.lastActivity > s.idleTimeoutNanos) {
                s.close()
                udp.remove(s.key)
            }
        }
        flushTraffic()
    }

    private fun flushTraffic() {
        if (pendingTraffic.isEmpty()) return
        for ((uid, v) in pendingTraffic) sink.onTraffic(uid, v[0], v[1])
        pendingTraffic.clear()
    }

    // ===========================================================================================
    // Token pumps: this is where the speed limit is actually applied
    // ===========================================================================================

    private fun pump(now: Long) {
        pumpDownloads(now)
        pumpUploads(now)
        pumpUdp(now)
    }

    private fun pumpDownloads(now: Long) {
        drainFree(downFree, clear = { it.inDownQueue = false }) { it.pumpDownload(CHUNK) }
        var budget = downQueue.size
        while (budget-- > 0) {
            val s = downQueue.peekFirst() ?: return
            if (s.state != TcpSession.State.ESTABLISHED) {
                downQueue.pollFirst()
                s.inDownQueue = false
                continue
            }
            val avail = limiter.down.available(now)
            if (avail < MIN_CHUNK) return // wait for the bucket to refill, keeping fair order
            downQueue.pollFirst()
            s.inDownQueue = false
            val n = s.pumpDownload(minOf(avail, CHUNK.toLong()).toInt())
            limiter.down.consume(n.toLong())
        }
    }

    private fun pumpUploads(now: Long) {
        drainFree(upFree, clear = { it.inUpQueue = false }) { it.pumpUpload(CHUNK) }
        var budget = upQueue.size
        while (budget-- > 0) {
            val s = upQueue.peekFirst() ?: return
            if (s.state != TcpSession.State.ESTABLISHED) {
                upQueue.pollFirst()
                s.inUpQueue = false
                continue
            }
            val avail = limiter.up.available(now)
            // Small writes (a request line) need not wait for a full chunk of tokens.
            if (avail < minOf(MIN_CHUNK, maxOf(1, s.pendingUpload))) return
            upQueue.pollFirst()
            s.inUpQueue = false
            val n = s.pumpUpload(minOf(avail, CHUNK.toLong()).toInt())
            limiter.up.consume(n.toLong())
        }
    }

    /** Exempt sessions (LAN, DNS) skip the buckets: serve each queued one once per loop pass. */
    private inline fun drainFree(
        queue: ArrayDeque<TcpSession>,
        clear: (TcpSession) -> Unit,
        action: (TcpSession) -> Unit,
    ) {
        var budget = queue.size
        while (budget-- > 0) {
            val s = queue.pollFirst() ?: return
            clear(s)
            if (s.state == TcpSession.State.ESTABLISHED) action(s)
        }
    }

    private fun pumpUdp(now: Long) {
        while (true) {
            val p = udpUp.peekFirst() ?: break
            if (limiter.up.available(now) < p.data.size) break
            udpUp.pollFirst()
            udpUpBytes -= p.data.size
            limiter.up.consume(p.data.size.toLong())
            sendUdpToRemote(p.session, p.data)
        }
        while (true) {
            val p = udpDown.peekFirst() ?: break
            if (limiter.down.available(now) < p.data.size) break
            udpDown.pollFirst()
            udpDownBytes -= p.data.size
            limiter.down.consume(p.data.size.toLong())
            deliverUdpToApp(p.session, p.data)
        }
    }

    // ===========================================================================================
    // Packets from the apps
    // ===========================================================================================

    private fun handlePacket(buf: ByteArray) {
        val ip = Ipv4.parse(buf, buf.size) ?: return
        if (ip.src != config.clientIp || ip.isFragment) return
        when (ip.protocol) {
            PROTO_TCP -> handleTcp(ip)
            PROTO_UDP -> handleUdp(ip)
            // ICMP and everything else is dropped: unprivileged apps cannot forward raw packets.
        }
    }

    private fun flowKey(srcPort: Int, dstIp: Int, dstPort: Int): Long =
        (srcPort.toLong() shl 48) or ((dstIp.toLong() and 0xFFFFFFFFL) shl 16) or dstPort.toLong()

    private fun handleTcp(ip: Ipv4) {
        val seg = Tcp.parse(ip) ?: return
        val key = flowKey(seg.srcPort, ip.dst, seg.dstPort)
        val existing = tcp[key]
        if (existing != null) {
            val freshSyn = seg.isSyn && !seg.isAck
            val staleForReuse = existing.state == TcpSession.State.TIME_WAIT ||
                (freshSyn && seg.seq != existing.clientIsn)
            if (!staleForReuse) {
                existing.onSegment(seg)
                return
            }
            existing.kill()
        }
        if (seg.isSyn && !seg.isAck) {
            openTcp(ip, seg, key)
        } else if (!seg.isRst && (seg.payloadLength > 0 || seg.isFin)) {
            // Data for a connection we no longer know (e.g. after the VPN restarted): make the app fail fast.
            sendResetFor(ip, seg)
        }
    }

    private fun openTcp(ip: Ipv4, seg: Tcp, key: Long) {
        if (tcp.size >= config.maxTcpSessions) {
            tcp.values.minByOrNull { it.lastActivity }?.reset()
        }
        val local = isLocalNetwork(ip.dst)
        val exempt = local || seg.dstPort == 53
        val uid = uids.uidOf(PROTO_TCP, seg.srcPort, ip.dst, seg.dstPort)
        val ch = try {
            SocketChannel.open()
        } catch (e: IOException) {
            sendResetFor(ip, seg)
            return
        }
        val session = TcpSession(
            host, key, seg.srcPort, ip.dst, seg.dstPort, uid, exempt, !local, ch,
            seg.seq, seg.mssOption, seg.window,
        )
        try {
            ch.configureBlocking(false)
            ch.socket().tcpNoDelay = true
            bestEffortProtect { protector.protect(ch.socket()) }
            val connected = ch.connect(remotes.resolve(ip.dst, seg.dstPort))
            tcp[key] = session
            session.selKey = ch.register(selector, SelectionKey.OP_CONNECT, session)
            if (connected) session.onConnectable()
        } catch (e: IOException) {
            tcp.remove(key)
            try {
                ch.close()
            } catch (_: IOException) {
            }
            sendResetFor(ip, seg)
        }
    }

    private fun sendResetFor(ip: Ipv4, seg: Tcp) {
        if (seg.isAck) {
            writer.tcp(ip.dst, seg.dstPort, ip.src, seg.srcPort, seg.ack, 0, FLAG_RST, 0)
        } else {
            val ackNum = seg.seq + seg.payloadLength + (if (seg.isFin) 1 else 0) + (if (seg.isSyn) 1 else 0)
            writer.tcp(ip.dst, seg.dstPort, ip.src, seg.srcPort, 0, ackNum, FLAG_RST or FLAG_ACK, 0)
        }
    }

    // ---- UDP ---------------------------------------------------------------------------------

    private fun handleUdp(ip: Ipv4) {
        val d = Udp.parse(ip) ?: return
        if (isMulticastOrBroadcast(ip.dst)) return
        if (config.blockQuic && d.dstPort == 443) {
            // QUIC is UDP and cannot be shaped as precisely as TCP. Refuse it politely so the app falls back to TCP.
            writer.icmpPortUnreachable(ip)
            return
        }
        val key = flowKey(d.srcPort, ip.dst, d.dstPort)
        val session = udp[key] ?: openUdp(ip, d, key) ?: return
        val now = System.nanoTime()
        session.lastActivity = now
        val data = ip.buf.copyOfRange(d.payloadOffset, d.payloadOffset + d.payloadLength)
        if (session.exempt) {
            sendUdpToRemote(session, data)
            return
        }
        if (udpUp.isEmpty() && limiter.up.available(now) >= data.size) {
            limiter.up.consume(data.size.toLong())
            sendUdpToRemote(session, data)
        } else if (udpUpBytes + data.size <= udpQueueLimit(limiter.up)) {
            udpUp.addLast(UdpPacket(session, data))
            udpUpBytes += data.size
        } // else: queue full -> drop, which is how a real bottleneck signals congestion
    }

    private fun openUdp(ip: Ipv4, d: Udp, key: Long): UdpSession? {
        val ch = try {
            DatagramChannel.open()
        } catch (_: IOException) {
            return null
        }
        return try {
            ch.configureBlocking(false)
            bestEffortProtect { protector.protect(ch.socket()) }
            ch.connect(remotes.resolve(ip.dst, d.dstPort))
            val local = isLocalNetwork(ip.dst)
            val uid = uids.uidOf(PROTO_UDP, d.srcPort, ip.dst, d.dstPort)
            val s = UdpSession(
                key, d.srcPort, ip.dst, d.dstPort, uid,
                exempt = local || d.dstPort == 53, counted = !local, channel = ch,
                onDatagram = ::udpFromRemote, now = System.nanoTime(),
            )
            s.selKey = ch.register(selector, SelectionKey.OP_READ, s)
            udp[key] = s
            s
        } catch (_: IOException) {
            try {
                ch.close()
            } catch (_: IOException) {
            }
            null
        }
    }

    private fun udpFromRemote(s: UdpSession, data: ByteArray) {
        if (s.exempt) {
            deliverUdpToApp(s, data)
            return
        }
        val now = System.nanoTime()
        if (udpDown.isEmpty() && limiter.down.available(now) >= data.size) {
            limiter.down.consume(data.size.toLong())
            deliverUdpToApp(s, data)
        } else if (udpDownBytes + data.size <= udpQueueLimit(limiter.down)) {
            udpDown.addLast(UdpPacket(s, data))
            udpDownBytes += data.size
        }
    }

    /** At most ~400 ms of queued data: long queues only add latency (bufferbloat) for real-time traffic. */
    private fun udpQueueLimit(bucket: TokenBucket): Int =
        maxOf(16 * 1024L, bucket.rate * 2 / 5).coerceAtMost(1 shl 20).toInt()

    private fun sendUdpToRemote(s: UdpSession, data: ByteArray) {
        s.sendToRemote(data)
        if (s.counted) host.account(s.uid, 0, data.size)
    }

    private fun deliverUdpToApp(s: UdpSession, data: ByteArray) {
        if (data.size > MAX_UDP_PAYLOAD) return
        writer.udp(s.remoteIp, s.remotePort, config.clientIp, s.clientPort, data, 0, data.size)
        if (s.counted) host.account(s.uid, data.size, 0)
    }

    private inline fun bestEffortProtect(block: () -> Unit) {
        // Our own app is excluded from the VPN anyway; protect() is belt and braces and may be unsupported.
        try {
            block()
        } catch (_: Exception) {
        }
    }

    /** Number of live flows, for diagnostics. */
    val activeFlows: Int get() = tcp.size + udp.size

    private companion object {
        const val MAX_PACKET = 32767
        const val MAX_UDP_PAYLOAD = 1472
        const val CHUNK = 16 * 1024
        const val MIN_CHUNK = TcpSession.MAX_MSS
        const val INBOX_BATCH = 256
        const val TICK_NANOS = 500_000_000L
        const val IDLE_TICK_NANOS = 2_000_000_000L
    }
}
