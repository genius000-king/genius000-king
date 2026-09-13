package io.nawah.linux.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import androidx.core.content.ContextCompat
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialProber

/** A serial-capable device the phone can see, and whether we may open it. */
data class UsbSerialDevice(
    val deviceName: String,
    val productName: String?,
    val vendorId: Int,
    val productId: Int,
    val driverName: String,
    val granted: Boolean,
) {
    /** `1a86:7523` — what a person types into a search engine. */
    val id: String get() = "%04x:%04x".format(vendorId, productId)
}

/**
 * Finds USB serial adapters and asks Android for permission to open them.
 *
 * Android owns the USB permission and will not delegate it: the `/dev/bus/usb` tree is
 * unreadable to an app, and the only way in is `UsbManager.openDevice`, which
 * hands back an already-open file descriptor after the user has agreed. There
 * is no root-free way for a program inside the container to open the device
 * itself — which is exactly why the app has to be the one holding it and
 * bridging.
 */
class UsbDevices(private val context: Context) {

    private val manager: UsbManager? =
        ContextCompat.getSystemService(context, UsbManager::class.java)

    /** Every attached device a vendored driver recognises. */
    fun list(): List<UsbSerialDevice> {
        val usb = manager ?: return emptyList()
        return drivers(usb).map { driver ->
            val device = driver.device
            UsbSerialDevice(
                deviceName = device.deviceName,
                productName = device.productName,
                vendorId = device.vendorId,
                productId = device.productId,
                driverName = driver.javaClass.simpleName.removeSuffix("SerialDriver"),
                granted = usb.hasPermission(device),
            )
        }
    }

    private fun drivers(usb: UsbManager): List<UsbSerialDriver> =
        runCatching { UsbSerialProber.getDefaultProber().findAllDrivers(usb) }.getOrDefault(emptyList())

    /** The first granted device, or null. What a session attaches on start. */
    internal fun firstGrantedDriver(): UsbSerialDriver? {
        val usb = manager ?: return null
        return drivers(usb).firstOrNull { usb.hasPermission(it.device) }
    }

    internal fun manager(): UsbManager? = manager

    /**
     * Asks the user for permission to open [deviceName].
     *
     * The result arrives as a broadcast rather than an activity result because
     * that is the only shape Android offers, and [onResult] is called on the
     * main thread once.
     */
    fun requestPermission(deviceName: String, onResult: (granted: Boolean) -> Unit) {
        val usb = manager ?: return onResult(false)
        val device = drivers(usb).map { it.device }.firstOrNull { it.deviceName == deviceName }
            ?: return onResult(false)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                runCatching { ctx.unregisterReceiver(this) }
                onResult(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false))
            }
        }
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(ACTION_PERMISSION),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        usb.requestPermission(
            device,
            PendingIntent.getBroadcast(
                context,
                0,
                Intent(ACTION_PERMISSION).setPackage(context.packageName),
                // Mutable because the system fills the device and the result
                // into this intent; an immutable one comes back empty.
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            ),
        )
    }

    private companion object {
        const val ACTION_PERMISSION = "io.nawah.linux.action.USB_PERMISSION"
    }
}
