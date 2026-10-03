package com.genius.saraat.vpn

import android.content.Context
import android.net.ConnectivityManager
import android.os.Process
import android.system.OsConstants
import com.genius.saraat.engine.UidResolver
import com.genius.saraat.engine.ipToInet
import java.net.InetAddress
import java.net.InetSocketAddress

/** Asks Android which app owns a connection (API 29+; allowed because we are the active VPN). */
class UidLookup(context: Context, clientIp: Int) : UidResolver {
    private val cm = context.getSystemService(ConnectivityManager::class.java)
    private val local = ipToInet(clientIp)
    private val wildcard = InetSocketAddress(InetAddress.getByAddress(ByteArray(4)), 0)

    override fun uidOf(protocol: Int, srcPort: Int, dstIp: Int, dstPort: Int): Int = try {
        val proto = if (protocol == 6) OsConstants.IPPROTO_TCP else OsConstants.IPPROTO_UDP
        val from = InetSocketAddress(local, srcPort)
        var uid = cm.getConnectionOwnerUid(proto, from, InetSocketAddress(ipToInet(dstIp), dstPort))
        // Unconnected UDP sockets are registered without a remote address.
        if (uid == Process.INVALID_UID && proto == OsConstants.IPPROTO_UDP) {
            uid = cm.getConnectionOwnerUid(proto, from, wildcard)
        }
        uid
    } catch (_: Exception) {
        UidResolver.UNKNOWN_UID
    }
}
