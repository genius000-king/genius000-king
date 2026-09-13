package io.nawah.linux.usb

import android.os.ParcelFileDescriptor
import java.io.Closeable
import java.io.FileInputStream
import java.io.FileOutputStream

/** Data bits, stop bits and parity, as the container last asked for them. */
internal data class SerialFraming(val dataBits: Int, val stopBits: Int, val parity: Int) {
    companion object {
        val DEFAULT = SerialFraming(dataBits = 8, stopBits = 1, parity = 0)
    }
}

/**
 * A pseudo-terminal whose slave becomes `/dev/ttyUSB0` inside the container.
 *
 * The point of holding the master here rather than bridging over a socket is
 * [baud]: an application inside the container sets the line speed with
 * `tcsetattr` on the slave, and on Linux the master reads back that same
 * termios. So `screen /dev/ttyUSB0 115200` and `arduino-cli` configure the real
 * device without knowing anything about Android.
 *
 * See `cpp/nawah_pty.c` for what a pty cannot do: no modem control lines, which
 * is why `nawah-usb reset` exists.
 */
internal class SerialPty private constructor(
    private val descriptor: ParcelFileDescriptor,
    /** e.g. `/dev/pts/7`. Bound into the container as `/dev/ttyUSB0`. */
    val slavePath: String,
) : Closeable {

    private val fd: Int get() = descriptor.fd

    /** Bytes the container has written, i.e. bytes to send to the device. */
    val input: FileInputStream = FileInputStream(descriptor.fileDescriptor)

    /** Bytes from the device, to be delivered to the container. */
    val output: FileOutputStream = FileOutputStream(descriptor.fileDescriptor)

    /** Line speed in bits per second, or 0 when it is not one we recognise. */
    val baud: Int get() = nativeBaud(fd)

    val framing: SerialFraming
        get() {
            val packed = nativeFraming(fd)
            if (packed == 0) return SerialFraming.DEFAULT
            return SerialFraming(
                dataBits = (packed shr 8) and 0xFF,
                stopBits = (packed shr 4) and 0xF,
                parity = packed and 0xF,
            )
        }

    override fun close() {
        runCatching { input.close() }
        runCatching { output.close() }
        runCatching { descriptor.close() }
    }

    companion object {
        private var loaded = runCatching { System.loadLibrary("nawah_pty") }.isSuccess

        /** Null when the device or the APK cannot provide one; never throws. */
        fun open(): SerialPty? {
            if (!loaded) {
                loaded = runCatching { System.loadLibrary("nawah_pty") }.isSuccess
                if (!loaded) return null
            }
            val master = runCatching { nativeOpen() }.getOrDefault(-1)
            if (master < 0) return null
            val name = runCatching { nativeSlaveName(master) }.getOrNull()
            if (name == null) {
                runCatching { ParcelFileDescriptor.adoptFd(master).close() }
                return null
            }
            return SerialPty(ParcelFileDescriptor.adoptFd(master), name)
        }

        @JvmStatic private external fun nativeOpen(): Int
        @JvmStatic private external fun nativeSlaveName(master: Int): String?
        @JvmStatic private external fun nativeBaud(master: Int): Int
        @JvmStatic private external fun nativeFraming(master: Int): Int
    }
}
