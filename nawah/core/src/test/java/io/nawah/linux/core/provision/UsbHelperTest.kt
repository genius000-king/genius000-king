package io.nawah.linux.core.provision

import com.google.common.truth.Truth.assertThat
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * `nawah-usb` is a program, so it is run rather than read.
 *
 * It exists because a pseudo-terminal carries no modem control lines — checked
 * in `drivers/tty/pty.c`, which defines no `.tiocmset` for Unix98 ptys — so
 * `avrdude` and `esptool` cannot reset a board through `/dev/ttyUSB0` and have
 * to ask the app out of band.
 */
class UsbHelperTest {

    @get:Rule val tmp = TemporaryFolder()

    private fun run(vararg args: String, port: Int): Pair<Int, String> {
        assumeTrue("bash is required", File("/bin/bash").canExecute())
        val script = tmp.newFile("nawah-usb-${System.nanoTime()}").apply {
            writeText(GuestScripts.usbHelper().replace("PORT=${GuestScripts.USB_CONTROL_PORT}", "PORT=$port"))
            setExecutable(true)
        }
        val process = ProcessBuilder(listOf("/bin/bash", script.path) + args)
            .redirectErrorStream(true).start()
        val out = process.inputStream.bufferedReader().readText()
        process.waitFor(20, TimeUnit.SECONDS)
        return process.exitValue() to out
    }

    /** Stands in for the app: one line in, one line out. */
    private fun server(reply: String): Pair<Int, java.net.ServerSocket> {
        val socket = java.net.ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))
        Thread {
            runCatching {
                socket.accept().use { client ->
                    val line = client.getInputStream().bufferedReader().readLine()
                    client.getOutputStream().bufferedWriter().apply {
                        write("$reply $line\n")
                        flush()
                    }
                }
            }
        }.apply { isDaemon = true }.start()
        return socket.localPort to socket
    }

    @Test
    fun `a command reaches the app and its answer comes back`() {
        val (port, socket) = server("ok")
        socket.use {
            val (code, out) = run("reset", port = port)

            assertThat(out).contains("ok reset")
            assertThat(code).isEqualTo(0)
        }
    }

    @Test
    fun `arguments are passed through whole, not just the first`() {
        val (port, socket) = server("ok")
        socket.use {
            val (_, out) = run("dtr", "on", port = port)

            assertThat(out).contains("dtr on")
        }
    }

    @Test
    fun `an error from the app is an error here`() {
        val (port, socket) = server("error")
        socket.use {
            val (code, _) = run("status", port = port)

            assertThat(code).isEqualTo(1)
        }
    }

    @Test
    fun `with nothing attached it says so instead of hanging`() {
        // A closed port, not a silent one: the message has to name what is
        // missing, because "no USB device" and "the app crashed" look the same
        // from inside the container.
        val socket = java.net.ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))
        val port = socket.localPort
        socket.close()

        val (code, out) = run("status", port = port)

        assertThat(out).contains("no USB device is attached")
        assertThat(code).isEqualTo(1)
    }

    @Test
    fun `it explains itself when asked, and when asked nothing`() {
        val (port, socket) = server("ok")
        socket.use {
            val (code, out) = run("--help", port = port)

            assertThat(out).contains("reset-esp")
            assertThat(out).contains("pseudo-terminal")
            assertThat(code).isEqualTo(2)
        }
    }

    @Test
    fun `the helper is valid bash`() {
        val file = tmp.newFile("check.sh").apply { writeText(GuestScripts.usbHelper()) }
        val check = ProcessBuilder("/bin/bash", "-n", file.path).redirectErrorStream(true).start()
        val out = check.inputStream.bufferedReader().readText()
        check.waitFor()

        assertThat(out).isEmpty()
        assertThat(check.exitValue()).isEqualTo(0)
    }
}
