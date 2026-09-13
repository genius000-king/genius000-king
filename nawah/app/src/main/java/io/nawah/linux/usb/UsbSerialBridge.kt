package io.nawah.linux.usb

import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import java.io.BufferedReader
import java.io.Closeable
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread

/**
 * Carries a USB serial device into the container as `/dev/ttyUSB0`.
 *
 * ```
 *  container                     app                        hardware
 *  ─────────                     ───                        ────────
 *  /dev/ttyUSB0  ── pty slave ──►│
 *  (a real tty)                  │ SerialPty (master)
 *                                │      │
 *                                │      ├── bytes ────────► UsbSerialPort
 *                                │      └── termios ──────► setParameters()
 *                                │
 *  nawah-usb ─── tcp 127.0.0.1 ─►│ control: dtr, rts, reset
 * ```
 *
 * The container gets a genuine terminal device, so `screen`, `minicom`,
 * `arduino-cli`, `pyserial` and `stty` work unmodified and without knowing that
 * Android exists. The baud rate is not configured anywhere in this app: it is
 * read back from the pty, because setting it is the container's business.
 *
 * ### The one thing this cannot do
 * A pty carries no modem control lines — `drivers/tty/pty.c` defines neither
 * `.tiocmget` nor `.tiocmset` for Unix98 ptys, so `TIOCMSET` returns `-ENOTTY`
 * and a tool that toggles DTR to reset a board gets an error rather than a
 * reset. That is a kernel fact, not a limitation of this code, and it is why
 * the control channel and the `nawah-usb` helper exist.
 */
internal class UsbSerialBridge(
    private val manager: UsbManager,
    private val log: (String) -> Unit,
) : Closeable {

    @Volatile private var running = false
    private var port: UsbSerialPort? = null
    private var pty: SerialPty? = null
    private var control: ServerSocket? = null
    private val threads = mutableListOf<Thread>()

    /** Last framing pushed to the device, so an unchanged poll costs nothing. */
    private var applied: Pair<Int, SerialFraming>? = null

    /**
     * Opens [driver]'s first port and a pty for it.
     *
     * @return the pty slave path to bind into the container, or null.
     */
    fun attach(driver: UsbSerialDriver): String? {
        close()

        val connection = runCatching { manager.openDevice(driver.device) }.getOrNull()
        if (connection == null) {
            log("nawah: Android would not open the USB device (permission?)")
            return null
        }
        val serial = driver.ports.firstOrNull()
        if (serial == null) {
            log("nawah: that USB device exposes no serial port")
            runCatching { connection.close() }
            return null
        }
        val opened = runCatching { serial.open(connection); serial }.getOrNull()
        if (opened == null) {
            log("nawah: the USB serial port refused to open")
            runCatching { connection.close() }
            return null
        }
        val terminal = SerialPty.open()
        if (terminal == null) {
            log("nawah: could not create a terminal device for the USB port")
            runCatching { opened.close() }
            return null
        }

        port = opened
        pty = terminal
        running = true
        applyFraming(force = true)

        threads += thread(name = "nawah-usb-out", isDaemon = true) { pumpToDevice(terminal, opened) }
        threads += thread(name = "nawah-usb-in", isDaemon = true) { pumpToContainer(terminal, opened) }
        threads += thread(name = "nawah-usb-termios", isDaemon = true) { followTermios() }
        threads += thread(name = "nawah-usb-control", isDaemon = true) { serveControl() }

        log("nawah: USB serial attached as /dev/ttyUSB0 (${driver.javaClass.simpleName})")
        return terminal.slavePath
    }

    // -- data ----------------------------------------------------------------

    private fun pumpToDevice(terminal: SerialPty, serial: UsbSerialPort) {
        val buffer = ByteArray(CHUNK)
        while (running) {
            val read = runCatching { terminal.input.read(buffer) }.getOrDefault(-1)
            if (read <= 0) break
            runCatching { serial.write(buffer.copyOf(read), WRITE_TIMEOUT_MS) }
                .onFailure { if (running) log("nawah: USB write failed: ${it.message}"); return }
        }
    }

    private fun pumpToContainer(terminal: SerialPty, serial: UsbSerialPort) {
        val buffer = ByteArray(CHUNK)
        while (running) {
            // A timeout rather than a blocking read: this is the only thread
            // that would otherwise sit in the driver forever and ignore close().
            val read = runCatching { serial.read(buffer, READ_TIMEOUT_MS) }.getOrElse {
                if (running) log("nawah: USB read failed: ${it.message}")
                return
            }
            if (read <= 0) continue
            runCatching { terminal.output.write(buffer, 0, read); terminal.output.flush() }
                .onFailure { return }
        }
    }

    // -- line settings -------------------------------------------------------

    /**
     * Follows the container's own `tcsetattr`.
     *
     * Nothing in this app decides the baud rate. `screen /dev/ttyUSB0 115200`
     * sets it on the pty slave, the master sees the same termios, and it is
     * applied to the real device here — which is the entire reason the app
     * holds a pty instead of a socket.
     */
    private fun followTermios() {
        while (running) {
            applyFraming(force = false)
            runCatching { Thread.sleep(TERMIOS_POLL_MS) }.getOrElse { return }
        }
    }

    private fun applyFraming(force: Boolean) {
        val terminal = pty ?: return
        val serial = port ?: return
        val baud = terminal.baud.takeIf { it > 0 } ?: DEFAULT_BAUD
        val framing = terminal.framing
        if (!force && applied == (baud to framing)) return
        applied = baud to framing

        val stop = when (framing.stopBits) {
            2 -> UsbSerialPort.STOPBITS_2
            else -> UsbSerialPort.STOPBITS_1
        }
        val parity = when (framing.parity) {
            1 -> UsbSerialPort.PARITY_ODD
            2 -> UsbSerialPort.PARITY_EVEN
            else -> UsbSerialPort.PARITY_NONE
        }
        runCatching { serial.setParameters(baud, framing.dataBits, stop, parity) }
            .onSuccess { log("nawah: USB serial at $baud ${framing.dataBits}N${framing.stopBits}") }
            .onFailure { log("nawah: the device refused $baud baud: ${it.message}") }
    }

    // -- control -------------------------------------------------------------

    /**
     * A line-based control channel for what a pty cannot carry.
     *
     * Loopback TCP and one line per command, so the guest side is a bash script
     * using `/dev/tcp` and needs no package at all. Commands: `dtr on|off`,
     * `rts on|off`, `reset`, `reset-esp`, `status`.
     */
    private fun serveControl() {
        val server = runCatching {
            ServerSocket(CONTROL_PORT, 4, InetAddress.getByName("127.0.0.1"))
        }.getOrElse {
            log("nawah: the USB control port is unavailable: ${it.message}")
            return
        }
        control = server
        while (running) {
            val client = runCatching { server.accept() }.getOrNull() ?: return
            runCatching { handle(client) }
            runCatching { client.close() }
        }
    }

    private fun handle(client: Socket) {
        val reader: BufferedReader = client.getInputStream().bufferedReader()
        val writer = client.getOutputStream().bufferedWriter()
        val line = reader.readLine()?.trim().orEmpty()
        writer.write(command(line) + "\n")
        writer.flush()
    }

    internal fun command(line: String): String {
        val serial = port ?: return "error no device attached"
        val parts = line.split(' ').filter { it.isNotBlank() }
        val on = parts.getOrNull(1)?.lowercase() in setOf("on", "1", "true", "high")
        return runCatching {
            when (parts.firstOrNull()?.lowercase()) {
                "dtr" -> { serial.dtr = on; "ok dtr=$on" }
                "rts" -> { serial.rts = on; "ok rts=$on" }
                "reset" -> { pulseDtr(); "ok reset" }
                "reset-esp" -> { espBootReset(); "ok reset-esp" }
                "status" -> "ok baud=${applied?.first ?: 0} dtr=${serial.dtr} rts=${serial.rts}"
                else -> "error unknown command"
            }
        }.getOrElse { "error ${it.message}" }
    }

    /** The Arduino auto-reset: DTR low for a moment, then released. */
    private fun pulseDtr() {
        val serial = port ?: return
        serial.dtr = true
        Thread.sleep(RESET_PULSE_MS)
        serial.dtr = false
    }

    /** The ESP32 download-mode sequence: hold BOOT (DTR) across a reset (RTS). */
    private fun espBootReset() {
        val serial = port ?: return
        serial.dtr = false
        serial.rts = true
        Thread.sleep(RESET_PULSE_MS)
        serial.dtr = true
        serial.rts = false
        Thread.sleep(RESET_PULSE_MS)
        serial.dtr = false
    }

    // -- teardown ------------------------------------------------------------

    override fun close() {
        running = false
        runCatching { control?.close() }
        control = null
        threads.forEach { it.interrupt() }
        threads.clear()
        runCatching { port?.close() }
        port = null
        runCatching { pty?.close() }
        pty = null
        applied = null
    }

    internal companion object {
        /** The guest's `nawah-usb` talks to this. Kept next to the audio ports. */
        const val CONTROL_PORT = 4721

        /** Until the container says otherwise. Arduino's own default. */
        const val DEFAULT_BAUD = 9600

        private const val CHUNK = 4096
        private const val READ_TIMEOUT_MS = 200
        private const val WRITE_TIMEOUT_MS = 2000
        private const val TERMIOS_POLL_MS = 150L
        private const val RESET_PULSE_MS = 100L
    }
}
