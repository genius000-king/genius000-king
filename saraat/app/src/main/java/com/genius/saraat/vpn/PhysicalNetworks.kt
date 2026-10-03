package com.genius.saraat.vpn

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import java.net.Inet4Address

/**
 * Tracks the real (non-VPN) networks. While our own VPN is up it is the system default, so the
 * only way to learn which Wi-Fi / mobile network is really underneath is to look at the others.
 */
class PhysicalNetworks(context: Context, private val onChange: () -> Unit) {
    private val cm = context.getSystemService(ConnectivityManager::class.java)

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = onChange()
        override fun onLost(network: Network) = onChange()
        override fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) = onChange()
    }

    fun start() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build()
        try {
            cm.registerNetworkCallback(request, callback)
        } catch (_: RuntimeException) {
        }
    }

    fun stop() {
        try {
            cm.unregisterNetworkCallback(callback)
        } catch (_: RuntimeException) {
        }
    }

    /** The network Android would normally use: validated Wi-Fi/Ethernet first, then mobile data. */
    @Suppress("DEPRECATION")
    fun best(): Network? = cm.allNetworks
        .mapNotNull { n -> cm.getNetworkCapabilities(n)?.let { n to it } }
        .filter { (_, c) ->
            c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                !c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        }
        .maxByOrNull { (_, c) ->
            var score = 0
            if (c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) score += 100
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) score += 10
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) score += 5
            score
        }?.first

    fun isMobile(network: Network? = best()): Boolean =
        network?.let { cm.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) } == true

    fun isMetered(network: Network?): Boolean =
        network?.let { cm.getNetworkCapabilities(it)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == false } ?: true

    /** IPv4 DNS servers of [network]; the tunnel only carries IPv4. */
    fun dnsServers(network: Network?): List<String> =
        network?.let { cm.getLinkProperties(it) }?.dnsServers
            ?.filterIsInstance<Inet4Address>()
            ?.mapNotNull { it.hostAddress }
            .orEmpty()

    /** Changes whenever the tunnel would need different DNS servers or a different underlying network. */
    fun signature(): String {
        val n = best()
        return "${n?.networkHandle}|${dnsServers(n).joinToString(",")}"
    }
}
