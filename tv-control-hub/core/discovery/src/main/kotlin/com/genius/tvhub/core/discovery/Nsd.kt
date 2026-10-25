package com.genius.tvhub.core.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import androidx.annotation.RequiresApi
import com.genius.tvhub.core.common.Log
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/** A TV found on the network, before the app decides whether it is paired. */
data class FoundService(val record: ServiceRecord, val host: String, val port: Int)

/** TV side: announce this TV until [stop]. */
class NsdAdvertiser(context: Context) {
    private val nsd = context.getSystemService(NsdManager::class.java)
    private var listener: NsdManager.RegistrationListener? = null

    fun start(record: ServiceRecord, port: Int) {
        stop()
        val info = NsdServiceInfo().apply {
            serviceName = ServiceRecord.instanceName(record.name)
            serviceType = ServiceRecord.SERVICE_TYPE
            setPort(port)
            record.toTxt().forEach { (k, v) -> setAttribute(k, v) }
        }
        val l = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(info: NsdServiceInfo) = Log.i(TAG, "announced as ${info.serviceName}")
            override fun onRegistrationFailed(info: NsdServiceInfo, code: Int) = Log.w(TAG, "announce failed: $code")
            override fun onServiceUnregistered(info: NsdServiceInfo) = Unit
            override fun onUnregistrationFailed(info: NsdServiceInfo, code: Int) = Unit
        }
        listener = l
        nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, l)
    }

    fun stop() {
        listener?.let { runCatching { nsd.unregisterService(it) } }
        listener = null
    }

    private companion object { const val TAG = "NsdAdvertiser" }
}

/**
 * Phone side: TVs currently announcing, as a live list. Holds a multicast lock while collected,
 * since many phones drop multicast packets with the screen on otherwise.
 */
class NsdBrowser(private val context: Context) {
    private val nsd = context.getSystemService(NsdManager::class.java)

    fun browse(): Flow<List<FoundService>> = callbackFlow {
        val found = ConcurrentHashMap<String, FoundService>()
        val lock = context.applicationContext.getSystemService(WifiManager::class.java)
            ?.createMulticastLock("tvhub-discovery")?.apply { setReferenceCounted(false); acquire() }
        val resolver = Resolver(nsd)

        fun publish() { trySend(found.values.sortedBy { it.record.name }) }

        val discovery = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(type: String) = Unit
            override fun onDiscoveryStopped(type: String) = Unit
            override fun onStartDiscoveryFailed(type: String, code: Int) { Log.w(TAG, "discovery failed: $code"); publish() }
            override fun onStopDiscoveryFailed(type: String, code: Int) = Unit
            override fun onServiceFound(info: NsdServiceInfo) {
                resolver.resolve(info) { resolved ->
                    val service = resolved.toFound() ?: return@resolve
                    found[resolved.serviceName] = service
                    publish()
                }
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                if (found.remove(info.serviceName) != null) publish()
            }
        }
        publish()
        nsd.discoverServices(ServiceRecord.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discovery)
        awaitClose {
            runCatching { nsd.stopServiceDiscovery(discovery) }
            resolver.close()
            lock?.release()
        }
    }

    private fun NsdServiceInfo.toFound(): FoundService? {
        val record = ServiceRecord.fromTxt(attributes, serviceName) ?: return null
        val addresses = if (Build.VERSION.SDK_INT >= 34) hostAddresses.mapNotNull { it.hostAddress } else listOfNotNull(@Suppress("DEPRECATION") host?.hostAddress)
        val host = ServiceRecord.pickAddress(addresses) ?: return null
        return FoundService(record, host.substringBefore('%'), port)
    }

    /** Android before 14 resolves one service at a time; newer versions take callbacks per service. */
    private class Resolver(private val nsd: NsdManager) {
        private val executor = Executors.newSingleThreadExecutor()
        private val callbacks = mutableListOf<Any>()

        fun resolve(info: NsdServiceInfo, onResolved: (NsdServiceInfo) -> Unit) {
            if (Build.VERSION.SDK_INT >= 34) resolveModern(info, onResolved) else executor.execute { resolveLegacy(info, onResolved) }
        }

        @RequiresApi(34)
        private fun resolveModern(info: NsdServiceInfo, onResolved: (NsdServiceInfo) -> Unit) {
            val cb = object : NsdManager.ServiceInfoCallback {
                override fun onServiceInfoCallbackRegistrationFailed(code: Int) = Unit
                override fun onServiceUpdated(updated: NsdServiceInfo) = onResolved(updated)
                override fun onServiceLost() = Unit
                override fun onServiceInfoCallbackUnregistered() = Unit
            }
            synchronized(callbacks) { callbacks += cb }
            nsd.registerServiceInfoCallback(info, executor, cb)
        }

        @Suppress("DEPRECATION")
        private fun resolveLegacy(info: NsdServiceInfo, onResolved: (NsdServiceInfo) -> Unit) {
            val done = java.util.concurrent.CountDownLatch(1)
            nsd.resolveService(info, object : NsdManager.ResolveListener {
                override fun onResolveFailed(info: NsdServiceInfo, code: Int) { done.countDown() }
                override fun onServiceResolved(info: NsdServiceInfo) { onResolved(info); done.countDown() }
            })
            done.await(5, java.util.concurrent.TimeUnit.SECONDS)
        }

        fun close() {
            if (Build.VERSION.SDK_INT >= 34) synchronized(callbacks) {
                callbacks.forEach { runCatching { nsd.unregisterServiceInfoCallback(it as NsdManager.ServiceInfoCallback) } }
                callbacks.clear()
            }
            executor.shutdownNow()
        }
    }

    private companion object { const val TAG = "NsdBrowser" }
}
