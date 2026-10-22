package com.tvhub.common

import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * First private IPv4 address of this device, shown on screen so a phone can connect.
 * Uses only standard Java APIs, which need no permission.
 */
object LocalAddress {

    fun ipv4(): String? =
        NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
            .filter { it.isUp && !it.isLoopback }
            .flatMap { it.inetAddresses.toList() }
            .filterIsInstance<Inet4Address>()
            .firstOrNull { it.isSiteLocalAddress }
            ?.hostAddress
}
