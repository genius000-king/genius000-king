package com.genius.saraat.engine

import java.io.IOException
import java.nio.channels.CancelledKeyException
import java.nio.channels.SelectionKey
import java.nio.channels.SocketChannel
import kotlin.random.Random

internal interface EngineHost {
    val writer: PacketWriter
    val clientIp: Int

    /** Scratch space for one TCP segment payload. */
    val scratch: ByteArray

    fun now(): Long
    fun queueDownload(s: TcpSession)
    fun queueUpload(s: TcpSession)
    fun account(uid: Int, down: Int, up: Int)
    fun sessionClosed(s: TcpSession)
}

/**
 * One TCP connection of an app, terminated inside the engine.
 *
 * The app believes it is talking to the real server: we answer its SYN with a SYN-ACK, ACK its
 * data, and push the server's bytes back to it with our own sequence numbers. On the other side a
 * real, non-blocking [SocketChannel] talks to the real server.
 *
 *   app  <--- fake TCP over TUN --->  [TcpSession]  <--- real socket --->  server
 *                                      upBuf: app -> server   (drained at the *upload* rate)
 *                                      downBuf: server -> app (filled at the *download* rate)
 *
 * Speed limiting happens only at the real socket: [pumpDownload] reads from it, [pumpUpload]
 * writes to it, and the engine decides how many bytes each call may move. When a buffer is full
 * we stop reading (download) or advertise a smaller TCP window (upload), and ordinary TCP flow
 * control slows the real sender down. Nothing is dropped, so throttled connections stay healthy.
 */
internal class TcpSession(
    private val host: EngineHost,
    val key: Long,
    private val clientPort: Int,
    private val remoteIp: Int,
    private val remotePort: Int,
    val uid: Int,
    /** Local network / DNS: bypasses the limiter. */
    val exempt: Boolean,
    /** Counts toward internet usage statistics. */
    private val counted: Boolean,
    private val channel: SocketChannel,
    val clientIsn: Int,
    peerMss: Int,
    initialPeerWindow: Int,
) {
    enum class State { CONNECTING, ESTABLISHED, TIME_WAIT, DEAD }

    var state = State.CONNECTING
        private set

    var selKey: SelectionKey? = null

    /** Engine bookkeeping: is this session currently waiting in a pump queue? */
    var inDownQueue = false
    var inUpQueue = false

    var lastActivity = host.now()
        private set

    private val createdAt = lastActivity
    private val mss = if (peerMss <= 0) DEFAULT_MSS else peerMss.coerceIn(MIN_MSS, MAX_MSS)

    // ---- sequence space -------------------------------------------------------------------
    private val iss = Random.nextInt()   // our initial sequence number towards the app
    private var rcvNxt = clientIsn + 1   // next byte we expect from the app
    private var sndUna = iss             // oldest byte the app has not acknowledged yet
    private var sndNxt = iss             // next byte we will send to the app
    private var peerWindow = initialPeerWindow
    private var lastAdvertised = 0

    // ---- buffers ----------------------------------------------------------------------------
    private val upBuf = ByteRing(UP_BUFFER)      // app -> server, waiting for upload tokens
    private val downBuf = ByteRing(DOWN_BUFFER)  // server -> app, from sndUna onwards

    // ---- connection state -------------------------------------------------------------------
    private var readReady = false        // selector said the real socket has data
    private var waitingWritable = false  // real socket's send buffer is full
    private var remoteEof = false        // server closed its side; we owe the app a FIN
    private var appFin = false           // app closed its side (we ACKed its FIN)
    private var outShutdown = false      // we half-closed the real socket
    private var finSent = false
    private var finSeq = 0
    private var finAcked = false
    private var dupAcks = 0
    private var retries = 0
    private var lastHeard = lastActivity // last time the app sent us anything with an ACK
    private var lastProbe = 0L
    private var ops = 0
    private var deadline = 0L

    /** Bytes waiting to be written to the real socket. */
    val pendingUpload: Int get() = upBuf.size

    // ===========================================================================================
    // Real-socket side (driven by the selector and the engine's pumps)
    // ===========================================================================================

    fun onSelected(key: SelectionKey) {
        try {
            if (key.isConnectable) onConnectable()
            if (state != State.DEAD && key.isValid && key.isReadable) onReadable()
            if (state != State.DEAD && key.isValid && key.isWritable) onWritable()
        } catch (_: CancelledKeyException) {
            // closed while we were handling a sibling event
        }
    }

    /** The connect() the engine started has finished; called by the engine when connect() succeeded instantly too. */
    fun onConnectable() {
        try {
            if (!channel.finishConnect()) return
        } catch (_: IOException) {
            refuse()
            return
        }
        state = State.ESTABLISHED
        sndNxt = iss + 1
        sndUna = sndNxt
        lastHeard = host.now()
        host.writer.tcp(
            remoteIp, remotePort, host.clientIp, clientPort,
            iss, rcvNxt, FLAG_SYN or FLAG_ACK, advertisedWindow(), mss = MAX_MSS,
        )
        setOps(SelectionKey.OP_READ)
    }

    private fun onReadable() {
        readReady = true
        removeOp(SelectionKey.OP_READ)   // the pump takes over until the socket is drained
        tryQueueDownload()
    }

    private fun onWritable() {
        waitingWritable = false
        removeOp(SelectionKey.OP_WRITE)
        tryQueueUpload()
    }

    /**
     * Engine pump: read up to [max] bytes from the real socket (the engine has already checked the
     * download tokens). Returns bytes read so the engine can charge the bucket.
     */
    fun pumpDownload(max: Int): Int {
        if (state != State.ESTABLISHED || remoteEof) return 0
        val want = minOf(max, downBuf.free)
        if (want <= 0) return 0
        val n = try {
            downBuf.readFrom(channel, want)
        } catch (_: IOException) {
            reset()
            return 0
        }
        when {
            n < 0 -> {
                remoteEof = true
                readReady = false
                flushToApp()
                maybeFinish()
                return 0
            }
            n == 0 -> {
                readReady = false
                addOp(SelectionKey.OP_READ)
                return 0
            }
        }
        if (counted) host.account(uid, n, 0)
        lastActivity = host.now()
        flushToApp()
        if (n < want) {            // drained the socket: let the selector tell us when more arrives
            readReady = false
            addOp(SelectionKey.OP_READ)
        } else {
            tryQueueDownload()     // probably more waiting
        }
        return n
    }

    /** Engine pump: write up to [max] buffered bytes to the real socket. Returns bytes written. */
    fun pumpUpload(max: Int): Int {
        if (state != State.ESTABLISHED) return 0
        val attempted = minOf(max, upBuf.size)
        var n = 0
        if (attempted > 0) {
            n = try {
                upBuf.writeTo(channel, attempted)
            } catch (_: IOException) {
                reset()
                return 0
            }
            if (n > 0) {
                if (counted) host.account(uid, 0, n)
                lastActivity = host.now()
            }
            if (upBuf.size > 0) {
                if (n < attempted) {   // the OS send buffer is full: wait for OP_WRITE
                    waitingWritable = true
                    addOp(SelectionKey.OP_WRITE)
                } else {
                    tryQueueUpload()
                }
            }
        }
        if (upBuf.size == 0) maybeShutdownOutput()
        sendWindowUpdateIfNeeded()
        return n
    }

    private fun tryQueueDownload() {
        if (state == State.ESTABLISHED && readReady && !remoteEof && downBuf.free > 0 && !inDownQueue) {
            host.queueDownload(this)
        }
    }

    private fun tryQueueUpload() {
        if (state == State.ESTABLISHED && !waitingWritable && !inUpQueue &&
            (upBuf.size > 0 || (appFin && !outShutdown))
        ) {
            host.queueUpload(this)
        }
    }

    private fun maybeShutdownOutput() {
        if (appFin && !outShutdown && upBuf.size == 0) {
            outShutdown = true
            try {
                channel.shutdownOutput()
            } catch (_: IOException) {
            }
        }
    }

    // ===========================================================================================
    // App side (segments arriving from the TUN)
    // ===========================================================================================

    fun onSegment(seg: Tcp) {
        lastActivity = host.now()
        if (seg.isRst) {
            kill()
            return
        }
        when (state) {
            State.DEAD -> return
            State.CONNECTING -> return // SYN retransmit: the SYN-ACK goes out once the real connect completes
            State.TIME_WAIT -> {
                if (seg.isFin || seg.payloadLength > 0) sendAck()
                return
            }
            State.ESTABLISHED -> Unit
        }
        if (seg.isSyn) {
            // The app never saw our SYN-ACK; say it again.
            if (sndUna == iss + 1 && sndNxt == sndUna) {
                host.writer.tcp(
                    remoteIp, remotePort, host.clientIp, clientPort,
                    iss, rcvNxt, FLAG_SYN or FLAG_ACK, advertisedWindow(), mss = MAX_MSS,
                )
            }
            return
        }
        if (seg.isAck) processAck(seg)
        if (state == State.ESTABLISHED && (seg.payloadLength > 0 || seg.isFin)) acceptData(seg)
        flushToApp()
        maybeFinish()
    }

    private fun processAck(seg: Tcp) {
        lastHeard = host.now()
        peerWindow = seg.window
        val acked = seg.ack - sndUna
        val outstanding = sndNxt - sndUna
        if (acked > 0 && acked <= outstanding) {
            var dataAcked = acked
            if (finSent && seg.ack == finSeq + 1) {
                finAcked = true
                dataAcked -= 1
            }
            downBuf.drop(dataAcked)
            sndUna = seg.ack
            dupAcks = 0
            retries = 0
            tryQueueDownload() // buffer space freed
        } else if (acked == 0 && seg.payloadLength == 0 && !seg.isFin && outstanding > 0) {
            if (++dupAcks == 3) retransmit()
        }
    }

    private fun acceptData(seg: Tcp) {
        var start = seg.seq
        var off = seg.payloadOffset
        var len = seg.payloadLength
        val behind = rcvNxt - start
        if (behind > 0) {              // overlaps what we already have: keep only the new tail
            val skip = minOf(behind, len)
            start += skip
            off += skip
            len -= skip
        }
        if (start != rcvNxt) {         // gap (or stale FIN): ask again for what we expect
            sendAck()
            return
        }
        val take = if (len > 0) upBuf.write(seg.ip.buf, off, len) else 0
        rcvNxt += take
        if (seg.isFin && take == len && !appFin) {
            appFin = true
            rcvNxt += 1
        }
        sendAck()
        tryQueueUpload()
    }

    /** Pushes as much buffered server data to the app as its TCP window allows, then the FIN if due. */
    private fun flushToApp() {
        if (state != State.ESTABLISHED || finSent) return
        while (true) {
            val inflight = sndNxt - sndUna
            val unsent = downBuf.size - inflight
            if (unsent <= 0) break
            val room = peerWindow - inflight
            if (room <= 0) break
            val n = minOf(unsent, room, mss)
            if (n < mss && n < unsent) break // avoid sending runts just because the window is almost full
            downBuf.copyTo(inflight, host.scratch, 0, n)
            host.writer.tcp(
                remoteIp, remotePort, host.clientIp, clientPort,
                sndNxt, rcvNxt, FLAG_ACK or FLAG_PSH, advertisedWindow(), host.scratch, 0, n,
            )
            if (inflight == 0) lastHeard = host.now()
            sndNxt += n
        }
        val inflight = sndNxt - sndUna
        if (remoteEof && downBuf.size - inflight == 0) {
            finSeq = sndNxt
            host.writer.tcp(
                remoteIp, remotePort, host.clientIp, clientPort,
                sndNxt, rcvNxt, FLAG_FIN or FLAG_ACK, advertisedWindow(),
            )
            if (inflight == 0) lastHeard = host.now()
            sndNxt += 1
            finSent = true
        }
    }

    /** Go-back-N: forget what we sent beyond the last ACK and send it again. The TUN is local, so this is rare. */
    private fun retransmit() {
        sndNxt = sndUna
        finSent = false
        dupAcks = 0
        lastHeard = host.now()
        flushToApp()
    }

    private fun advertisedWindow(): Int {
        val free = upBuf.free
        val w = if (free < mss) 0 else minOf(free, 65535)
        lastAdvertised = w
        return w
    }

    private fun sendAck() {
        host.writer.tcp(
            remoteIp, remotePort, host.clientIp, clientPort,
            sndNxt, rcvNxt, FLAG_ACK, advertisedWindow(),
        )
    }

    private fun sendWindowUpdateIfNeeded() {
        if (state == State.ESTABLISHED && lastAdvertised < UP_BUFFER / 4 && upBuf.free >= UP_BUFFER / 2) sendAck()
    }

    // ===========================================================================================
    // Lifecycle
    // ===========================================================================================

    /** Both directions are closed and acknowledged: linger briefly to answer stray segments. */
    private fun maybeFinish() {
        if (state == State.ESTABLISHED && finAcked && appFin) {
            state = State.TIME_WAIT
            deadline = host.now() + TIME_WAIT_NANOS
            closeChannel()
        }
    }

    /** Remote end unreachable or refused: tell the app immediately instead of letting it time out. */
    private fun refuse() {
        host.writer.tcp(remoteIp, remotePort, host.clientIp, clientPort, 0, rcvNxt, FLAG_RST or FLAG_ACK, 0)
        kill()
    }

    /** Abort: RST the app, drop the real socket. */
    fun reset() {
        if (state == State.ESTABLISHED) {
            host.writer.tcp(
                remoteIp, remotePort, host.clientIp, clientPort,
                sndNxt, rcvNxt, FLAG_RST or FLAG_ACK, 0,
            )
        }
        kill()
    }

    fun kill() {
        if (state == State.DEAD) return
        state = State.DEAD
        closeChannel()
        host.sessionClosed(this)
    }

    /** Periodic timers (called by the engine every few hundred ms). */
    fun tick(now: Long) {
        when (state) {
            State.CONNECTING -> if (now - createdAt > CONNECT_TIMEOUT_NANOS) refuse()
            State.TIME_WAIT -> if (now >= deadline) kill()
            State.ESTABLISHED -> {
                val outstanding = sndNxt - sndUna
                if (outstanding > 0 && now - lastHeard > rto()) {
                    if (++retries > MAX_RETRIES) {
                        reset()
                        return
                    }
                    retransmit()
                } else if (outstanding == 0 && downBuf.size > 0 && peerWindow == 0 && now - lastProbe > PROBE_NANOS) {
                    // Zero-window probe: an empty segment one byte "in the past" makes the app re-announce its window.
                    lastProbe = now
                    host.writer.tcp(
                        remoteIp, remotePort, host.clientIp, clientPort,
                        sndUna - 1, rcvNxt, FLAG_ACK, advertisedWindow(),
                    )
                }
                if (now - lastActivity > IDLE_TIMEOUT_NANOS) {
                    reset()
                    return
                }
                tryQueueDownload()   // safety net against any missed wake-up
                tryQueueUpload()
            }
            State.DEAD -> Unit
        }
    }

    private fun rto(): Long = RTO_BASE_NANOS shl retries.coerceAtMost(4)

    fun closeChannel() {
        try {
            selKey?.cancel()
            channel.close()
        } catch (_: IOException) {
        }
    }

    private fun setOps(newOps: Int) {
        ops = newOps
        val k = selKey
        if (k != null && k.isValid) k.interestOps(ops)
    }

    private fun addOp(op: Int) = setOps(ops or op)
    private fun removeOp(op: Int) = setOps(ops and op.inv())

    companion object {
        const val MAX_MSS = 1460
        const val DEFAULT_MSS = 536
        const val MIN_MSS = 200
        const val UP_BUFFER = 32 * 1024
        const val DOWN_BUFFER = 64 * 1024

        private const val CONNECT_TIMEOUT_NANOS = 15_000_000_000L
        private const val TIME_WAIT_NANOS = 5_000_000_000L
        private const val RTO_BASE_NANOS = 1_000_000_000L
        private const val PROBE_NANOS = 1_000_000_000L
        private const val IDLE_TIMEOUT_NANOS = 2L * 60 * 60 * 1_000_000_000L
        private const val MAX_RETRIES = 8
    }
}
