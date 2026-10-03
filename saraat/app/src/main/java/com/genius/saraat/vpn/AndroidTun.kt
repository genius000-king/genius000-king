package com.genius.saraat.vpn

import android.os.ParcelFileDescriptor
import com.genius.saraat.engine.TunPort
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException

/** The TUN file descriptor that VpnService.establish() returns, seen as a [TunPort]. */
class AndroidTun(private val pfd: ParcelFileDescriptor) : TunPort {
    private val input = FileInputStream(pfd.fileDescriptor)
    private val output = FileOutputStream(pfd.fileDescriptor)

    override fun read(buf: ByteArray): Int = try {
        input.read(buf)
    } catch (_: IOException) {
        -1
    }

    override fun write(buf: ByteArray, off: Int, len: Int) {
        try {
            output.write(buf, off, len)
        } catch (_: IOException) {
            // The tunnel is going away; the engine is being stopped.
        }
    }

    override fun close() {
        try {
            pfd.close()
        } catch (_: IOException) {
        }
    }
}
