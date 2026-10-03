package com.genius.saraat.engine.lab

import com.genius.saraat.engine.EngineConfig
import com.genius.saraat.engine.EngineLog
import com.genius.saraat.engine.Limiter
import com.genius.saraat.engine.RemoteResolver
import com.genius.saraat.engine.TrafficSink
import com.genius.saraat.engine.TunEngine
import com.genius.saraat.engine.TunPort
import com.genius.saraat.engine.parseIpv4
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicLong

/** TunPort backed by the length-prefixed socket that tools/tun-lab/tun_bridge.py exposes. */
class SocketTunPort(private val socket: Socket) : TunPort {
    private val input = DataInputStream(socket.getInputStream().buffered())
    private val output = DataOutputStream(socket.getOutputStream().buffered(65536))

    override fun read(buf: ByteArray): Int = try {
        val len = input.readUnsignedShort()
        input.readFully(buf, 0, len)
        len
    } catch (e: java.io.IOException) {
        -1
    }

    @Synchronized
    override fun write(buf: ByteArray, off: Int, len: Int) {
        output.writeShort(len)
        output.write(buf, off, len)
        output.flush()
    }

    override fun close() = socket.close()
}

/**
 * Runs the engine against a real kernel TUN (see tools/tun-lab/README.md).
 *
 *   --down <kbps> --up <kbps>   limits (0 = unlimited)
 *   --port <p>                  bridge port (default 19000)
 *   --seconds <n>               how long to run (default 60)
 *   --quic <true|false>         block UDP/443 (default true)
 *
 * Destinations in 203.0.113.0/24 (TEST-NET-3) are redirected to 127.0.0.1 so tests need no internet.
 */
fun main(argv: Array<String>) {
    val args = argv.toList().chunked(2).associate { it[0].removePrefix("--") to it.getOrElse(1) { "" } }
    val down = args["down"]?.toLong() ?: 1000
    val up = args["up"]?.toLong() ?: 1000
    val port = args["port"]?.toInt() ?: 19000
    val seconds = args["seconds"]?.toInt() ?: 60
    val quic = args["quic"]?.toBoolean() ?: true

    val socket = Socket(InetAddress.getLoopbackAddress(), port)
    socket.tcpNoDelay = true
    val limiter = Limiter().apply { setKbps(down, up) }
    val downBytes = AtomicLong()
    val upBytes = AtomicLong()
    val testNet = parseIpv4("203.0.113.0")
    val done = CountDownLatch(1)

    val engine = TunEngine(
        tun = SocketTunPort(socket),
        config = EngineConfig(clientIp = parseIpv4("10.1.10.1"), blockQuic = quic),
        limiter = limiter,
        sink = TrafficSink { _, d, u -> downBytes.addAndGet(d); upBytes.addAndGet(u) },
        remotes = RemoteResolver { ip, p ->
            if ((ip ushr 8) == (testNet ushr 8)) InetSocketAddress(InetAddress.getLoopbackAddress(), p)
            else Direct(ip, p)
        },
        logger = EngineLog { System.err.println("[engine] $it") },
    )
    engine.onStopped = { done.countDown() }
    engine.start()
    println("[lab] engine running: down=${down}kbps up=${up}kbps quic-block=$quic for ${seconds}s")

    val started = System.nanoTime()
    var lastDown = 0L
    var lastUp = 0L
    while (System.nanoTime() - started < seconds * 1_000_000_000L && done.count > 0) {
        Thread.sleep(1000)
        val d = downBytes.get()
        val u = upBytes.get()
        println("[lab] t=${(System.nanoTime() - started) / 1_000_000_000}s  down=${(d - lastDown) * 8 / 1000} kbps  up=${(u - lastUp) * 8 / 1000} kbps  flows=${engine.activeFlows}")
        lastDown = d
        lastUp = u
    }
    engine.stop()
    println("[lab] total down=${downBytes.get()} B up=${upBytes.get()} B")
}

private fun Direct(ip: Int, port: Int): InetSocketAddress = RemoteResolver.Direct.resolve(ip, port)
