package com.genius.tvhub.engine.adb.link

import dadb.AdbKeyPair
import dadb.Dadb
import java.io.File

/**
 * The connection to the TV's own adbd over loopback, and the key that identifies TV Hub to it.
 * The key is created once; after the user ticks "Always allow", adbd remembers it.
 */
internal class AdbLink(private val keyDir: File, private val host: String = "127.0.0.1", private val port: Int = 5555) {
    @Volatile private var dadb: Dadb? = null

    private fun keys(): AdbKeyPair {
        val priv = File(keyDir, "adbkey")
        val pub = File(keyDir, "adbkey.pub")
        if (!priv.exists() || !pub.exists()) {
            keyDir.mkdirs()
            AdbKeyPair.generate(priv, pub)
        }
        return AdbKeyPair.read(priv, pub)
    }

    @Volatile private var pending: Dadb? = null

    /**
     * Opens the connection and proves it with a trivial command. Blocks while the TV shows its
     * approval prompt; [close] from another thread gives up. No socket timeout: a still screen
     * sends nothing for minutes, and that must not look like a dead connection.
     */
    fun open(): Dadb {
        dadb?.let { return it }
        val d = Dadb.create(host, port, keys(), CONNECT_TIMEOUT_MILLIS, 0)
        pending = d
        try {
            d.shell("echo ok")
        } finally {
            pending = null
        }
        dadb = d
        return d
    }

    fun current(): Dadb? = dadb

    fun close() {
        runCatching { pending?.close() }
        runCatching { dadb?.close() }
        dadb = null
    }

    /** Is anything listening on the ADB port? Tells "network ADB off" from "not approved". */
    fun portOpen(): Boolean = runCatching {
        java.net.Socket().use { it.connect(java.net.InetSocketAddress(host, port), CONNECT_TIMEOUT_MILLIS) }
        true
    }.getOrDefault(false)

    private companion object { const val CONNECT_TIMEOUT_MILLIS = 1_500 }
}
