package com.genius.saraat.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/** In-memory TUN: [toEngine] is what the "app" sends, [toApp] is what the engine writes back. */
internal class PipePort : TunPort {
    val toEngine = LinkedBlockingQueue<ByteArray>()
    val toApp = LinkedBlockingQueue<ByteArray>()
    @Volatile var closed = false

    override fun read(buf: ByteArray): Int {
        while (!closed) {
            val p = toEngine.poll(50, TimeUnit.MILLISECONDS) ?: continue
            System.arraycopy(p, 0, buf, 0, p.size)
            return p.size
        }
        return -1
    }

    override fun write(buf: ByteArray, off: Int, len: Int) {
        toApp.add(buf.copyOfRange(off, off + len))
    }

    override fun close() {
        closed = true
    }
}

/**
 * A hand-rolled TCP client standing in for an app. It speaks just enough TCP (handshake, in-order
 * data, ACKs, window awareness, FIN) to push real traffic through the engine and a real loopback server.
 */
internal class FakeApp(private val pipe: PipePort, private val serverIp: Int, private val serverPort: Int) {
    val clientIp = parseIpv4("10.1.10.1")
    private val clientPort = 40000
    private val out = PacketWriter(object : TunPort {
        override fun read(buf: ByteArray) = -1
        override fun write(buf: ByteArray, off: Int, len: Int) {
            pipe.toEngine.add(buf.copyOfRange(off, off + len))
        }
        override fun close() = Unit
    })

    var seq = 1000
    var ack = 0
    var peerWindow = 65535
    var peerIsn = 0

    private fun send(flags: Int, payload: ByteArray? = null, len: Int = 0, sendSeq: Int = seq, mss: Int = 0) =
        out.tcp(clientIp, clientPort, serverIp, serverPort, sendSeq, ack, flags, 65535, payload, 0, len, mss)

    /** Next TCP segment the engine sent to this app, or null on timeout. */
    fun next(timeoutMs: Long): Tcp? {
        val p = pipe.toApp.poll(timeoutMs, TimeUnit.MILLISECONDS) ?: return null
        val ip = Ipv4.parse(p, p.size) ?: return null
        if (ip.protocol != PROTO_TCP) return null
        return Tcp.parse(ip)?.takeIf { it.dstPort == clientPort }
    }

    fun handshake() {
        send(FLAG_SYN, sendSeq = seq, mss = 1460)
        seq += 1
        while (true) {
            val seg = next(5000) ?: error("no SYN-ACK")
            if (seg.isSyn && seg.isAck) {
                peerIsn = seg.seq
                ack = seg.seq + 1
                peerWindow = seg.window
                send(FLAG_ACK)
                return
            }
        }
    }

    /** Sends a SYN and reports whether the engine answered with an RST (true) instead of a SYN-ACK. */
    fun connectExpectingReset(): Boolean {
        send(FLAG_SYN, sendSeq = seq, mss = 1460)
        seq += 1
        val seg = next(5000) ?: error("no reply to SYN")
        return seg.isRst
    }

    /** Receives until the engine sends FIN. Returns the number of payload bytes. */
    fun receiveAll(timeoutMs: Long = 30_000): Long {
        var total = 0L
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val seg = next(200) ?: continue
            if (seg.seq != ack) { send(FLAG_ACK); continue }          // out of order: ask again
            if (seg.payloadLength > 0) {
                total += seg.payloadLength
                ack += seg.payloadLength
            }
            if (seg.isFin) {
                ack += 1
                send(FLAG_FIN or FLAG_ACK)
                seq += 1
                return total
            }
            if (seg.payloadLength > 0) send(FLAG_ACK)
        }
        error("download timed out after $total bytes")
    }

    /** Sends [total] bytes respecting the engine's advertised window; returns when all are acknowledged. */
    fun sendAll(total: Int, timeoutMs: Long = 60_000) {
        val data = ByteArray(1460) { 7 }
        var sent = 0
        var nxt = seq
        var una = seq
        var lastSend = System.currentTimeMillis()
        val deadline = lastSend + timeoutMs
        while (una - seq < total && System.currentTimeMillis() < deadline) {
            while (sent < total && peerWindow - (nxt - una) >= minOf(1460, total - sent)) {
                val n = minOf(1460, total - sent)
                send(FLAG_ACK or FLAG_PSH, data, n, sendSeq = nxt)
                nxt += n
                sent += n
                lastSend = System.currentTimeMillis()
            }
            val seg = next(20)
            if (seg != null && seg.isAck) {
                if (seg.ack - una > 0) una = seg.ack
                peerWindow = seg.window
            } else if (sent < total && nxt == una && System.currentTimeMillis() - lastSend > 300) {
                send(FLAG_ACK, sendSeq = nxt - 1) // zero-window probe, like a real TCP stack
                lastSend = System.currentTimeMillis()
            }
        }
        check(una - seq >= total) { "upload not acknowledged: ${una - seq} of $total" }
        seq = nxt
    }
}

class EngineFlowTest {
    private val loopback = InetAddress.getLoopbackAddress()
    private val fakeServerIp = parseIpv4("203.0.113.9")

    private inline fun <T> withEngine(downKbps: Long, upKbps: Long, serverPort: Int, body: (FakeApp, TunEngine) -> T): T {
        val pipe = PipePort()
        val app = FakeApp(pipe, fakeServerIp, 8080)
        val engine = TunEngine(
            tun = pipe,
            config = EngineConfig(clientIp = app.clientIp),
            limiter = Limiter().apply { setKbps(downKbps, upKbps) },
            remotes = RemoteResolver { _, _ -> InetSocketAddress(loopback, serverPort) },
        )
        engine.start()
        try {
            return body(app, engine)
        } finally {
            engine.stop()
        }
    }

    /** Server that immediately writes [bytes] bytes to the first client, then closes. */
    private fun sender(bytes: Int): ServerSocket {
        val server = ServerSocket(0, 5, loopback)
        thread(isDaemon = true) {
            server.accept().use { s ->
                val chunk = ByteArray(8192) { 1 }
                var left = bytes
                while (left > 0) {
                    val n = minOf(left, chunk.size)
                    s.getOutputStream().write(chunk, 0, n)
                    left -= n
                }
            }
        }
        return server
    }

    @Test(timeout = 30_000)
    fun downloadIsDeliveredIntactWithoutALimit() {
        val server = sender(2_000_000)
        withEngine(0, 0, server.localPort) { app, _ ->
            val t0 = System.nanoTime()
            app.handshake()
            val got = app.receiveAll()
            val seconds = (System.nanoTime() - t0) / 1e9
            assertEquals(2_000_000L, got)
            assertTrue("unlimited transfer took ${seconds}s", seconds < 5.0)
        }
        server.close()
    }

    @Test(timeout = 40_000)
    fun downloadRateMatchesTheLimit() {
        val bytes = 250_000
        val limitKbps = 800L // 100 kB/s
        val server = sender(bytes)
        withEngine(limitKbps, 0, server.localPort) { app, _ ->
            val t0 = System.nanoTime()
            app.handshake()
            val got = app.receiveAll()
            val seconds = (System.nanoTime() - t0) / 1e9
            assertEquals(bytes.toLong(), got)
            val kbps = bytes * 8 / 1000.0 / seconds
            println("download: $bytes B in %.2fs = %.0f kbps (limit $limitKbps)".format(seconds, kbps))
            assertTrue("rate $kbps kbps vs limit $limitKbps", kbps in limitKbps * 0.85..limitKbps * 1.25)
        }
        server.close()
    }

    @Test(timeout = 40_000)
    fun uploadRateMatchesTheLimit() {
        val bytes = 150_000
        val limitKbps = 400L // 50 kB/s
        val server = ServerSocket(0, 5, loopback)
        val done = CountDownLatch(1)
        var finishedAt = 0L
        thread(isDaemon = true) {
            server.accept().use { s ->
                var got = 0
                val buf = ByteArray(8192)
                while (got < bytes) {
                    val n = s.getInputStream().read(buf)
                    if (n < 0) break
                    got += n
                }
                finishedAt = System.nanoTime()
                done.countDown()
            }
        }
        withEngine(0, limitKbps, server.localPort) { app, _ ->
            val t0 = System.nanoTime()
            app.handshake()
            app.sendAll(bytes)
            assertTrue("server did not receive everything", done.await(20, TimeUnit.SECONDS))
            val seconds = (finishedAt - t0) / 1e9
            val kbps = bytes * 8 / 1000.0 / seconds
            println("upload: $bytes B in %.2fs = %.0f kbps (limit $limitKbps)".format(seconds, kbps))
            assertTrue("rate $kbps kbps vs limit $limitKbps", kbps in limitKbps * 0.85..limitKbps * 1.3)
        }
        server.close()
    }

    @Test(timeout = 20_000)
    fun refusedConnectionResetsTheApp() {
        val dead = ServerSocket(0, 1, loopback).also { it.close() } // a port nobody listens on
        withEngine(0, 0, dead.localPort) { app, _ ->
            assertTrue("expected an RST for an unreachable server", app.connectExpectingReset())
        }
    }
}
