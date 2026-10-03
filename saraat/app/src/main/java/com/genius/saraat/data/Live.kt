package com.genius.saraat.data

import kotlinx.coroutines.flow.MutableStateFlow

/** Bytes per second in each direction. */
data class Speed(val down: Long = 0, val up: Long = 0)

/** Process-wide live state published by the service and read by the UI. */
object Live {
    val speed = MutableStateFlow(Speed())

    /** The last 60 one-second samples, oldest first. */
    val history = MutableStateFlow<List<Speed>>(emptyList())

    /** The VPN tunnel (the limiter) is up. */
    val vpnActive = MutableStateFlow(false)

    /** The background service is running (monitoring and/or limiting). */
    val serviceRunning = MutableStateFlow(false)

    /** Something the user should know about (e.g. permission revoked). */
    val message = MutableStateFlow<String?>(null)
}
