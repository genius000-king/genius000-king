package io.nawah.linux.session

import android.net.LocalSocket
import android.net.LocalSocketAddress
import java.io.File

/**
 * Answers whether something is actually listening on a unix socket.
 *
 * This exists because the obvious check — does the file exist — is wrong, and
 * wrong in a way that only shows up on the *second* run. A killed X server
 * leaves its socket file behind; `connect()` to it then fails with
 * ECONNREFUSED while `File.exists()` happily returns true. The launch reported
 * "display server ready" in milliseconds, started the desktop against a dead
 * socket, and the user read the result as "it worked once and then stopped".
 *
 * An interface rather than a function so the waiting logic can be tested
 * without an Android runtime; the logic is the part that was wrong.
 */
internal fun interface SocketProbe {
    fun isListening(socket: File): Boolean
}

/** The real one: an actual connection attempt, immediately closed. */
internal object LocalSocketProbe : SocketProbe {
    override fun isListening(socket: File): Boolean = runCatching {
        LocalSocket().use { client ->
            client.connect(LocalSocketAddress(socket.absolutePath, LocalSocketAddress.Namespace.FILESYSTEM))
            client.isConnected
        }
    }.getOrDefault(false)
}
