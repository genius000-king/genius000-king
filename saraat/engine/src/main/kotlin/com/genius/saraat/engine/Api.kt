package com.genius.saraat.engine

import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.Socket

/** The virtual network interface the engine reads packets from and writes packets to. */
interface TunPort {
    /** Blocks until a packet arrives. Returns its length, or -1 when the interface is closed. */
    fun read(buf: ByteArray): Int

    fun write(buf: ByteArray, off: Int, len: Int)

    fun close()
}

/** Marks sockets so they bypass the VPN (on Android: VpnService.protect). Best effort. */
interface SocketProtector {
    fun protect(socket: Socket): Boolean
    fun protect(socket: DatagramSocket): Boolean

    companion object {
        val None = object : SocketProtector {
            override fun protect(socket: Socket) = true
            override fun protect(socket: DatagramSocket) = true
        }
    }
}

/** Finds which app (Linux uid) owns a flow. Return [UNKNOWN_UID] if it cannot be determined. */
fun interface UidResolver {
    fun uidOf(protocol: Int, srcPort: Int, dstIp: Int, dstPort: Int): Int

    companion object {
        const val UNKNOWN_UID = -1
        val None = UidResolver { _, _, _, _ -> UNKNOWN_UID }
    }
}

/** Receives batched byte counts (called from the engine thread roughly every 250 ms). */
fun interface TrafficSink {
    fun onTraffic(uid: Int, downBytes: Long, upBytes: Long)
}

/** Maps a destination as seen by the app to the address the engine really connects to. */
fun interface RemoteResolver {
    fun resolve(dstIp: Int, dstPort: Int): InetSocketAddress

    companion object {
        val Direct = RemoteResolver { ip, port -> InetSocketAddress(ipToInet(ip), port) }
    }
}

fun interface EngineLog {
    fun log(message: String)

    companion object {
        val None = EngineLog { }
    }
}

class EngineConfig(
    /** Address the apps use as their source inside the tunnel (the VPN's own address). */
    val clientIp: Int,
    /** Drop UDP/443 (QUIC) so browsers fall back to TCP, which can be shaped precisely. */
    val blockQuic: Boolean = true,
    val maxTcpSessions: Int = 512,
)

/** Shared speed limits for the whole device. */
class Limiter {
    internal val down = TokenBucket()
    internal val up = TokenBucket()

    /** Rates in kilobits per second; 0 = unlimited. Safe to call from any thread, takes effect immediately. */
    fun setKbps(downKbps: Long, upKbps: Long) {
        down.rate = downKbps * 125
        up.rate = upKbps * 125
    }
}
