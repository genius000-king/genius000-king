package com.genius.tvhub.engine.apps.install

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.os.Build
import androidx.core.content.ContextCompat
import com.genius.tvhub.core.protocol.InstallState
import com.genius.tvhub.engine.apps.api.InstallUpdate
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Streams APKs (one app, base plus splits) into a PackageInstaller session as they arrive, so a
 * 200 MB app never has to fit in RAM. Android asks the person at the TV to confirm; that screen
 * is opened for them.
 */
class SessionInstaller(private val context: Context) {
    private val installer = context.packageManager.packageInstaller
    private class Pending(val sessionId: Int, val session: PackageInstaller.Session, val ledger: InstallLedger)
    private val pending = ConcurrentHashMap<String, Pending>()

    fun begin(splitSizes: List<Long>): String {
        val ledger = InstallLedger(splitSizes)
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply { setSize(splitSizes.sum()) }
        val id = installer.createSession(params)
        val transfer = UUID.randomUUID().toString()
        pending[transfer] = Pending(id, installer.openSession(id), ledger)
        return transfer
    }

    fun write(transferId: String, split: Int, offset: Long, data: ByteArray) {
        val p = pending[transferId] ?: throw IllegalStateException("unknown install $transferId")
        p.ledger.accept(split, offset, data.size)
        p.session.openWrite(p.ledger.splitName(split), offset, data.size.toLong()).use { out ->
            out.write(data)
            p.session.fsync(out)
        }
    }

    fun commit(transferId: String): Flow<InstallUpdate> = callbackFlow {
        val p = pending.remove(transferId) ?: run { trySend(InstallUpdate(InstallState.FAILED, "unknown install")); close(); return@callbackFlow }
        if (!p.ledger.complete) {
            p.session.abandon()
            trySend(InstallUpdate(InstallState.FAILED, "transfer incomplete")); close(); return@callbackFlow
        }
        val action = "com.genius.tvhub.INSTALL_${p.sessionId}"
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE).orEmpty()
                when (status) {
                    PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                        @Suppress("DEPRECATION")
                        val confirm = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else intent.getParcelableExtra(Intent.EXTRA_INTENT)
                        confirm?.let { runCatching { ctx.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
                        trySend(InstallUpdate(InstallState.WAITING_FOR_USER))
                    }
                    PackageInstaller.STATUS_SUCCESS -> { trySend(InstallUpdate(InstallState.SUCCESS)); close() }
                    else -> { trySend(InstallUpdate(InstallState.FAILED, message.ifEmpty { "status $status" })); close() }
                }
            }
        }
        ContextCompat.registerReceiver(context, receiver, IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED)
        // Mutable: the installer fills in the status extras.
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        val pi = PendingIntent.getBroadcast(context, p.sessionId, Intent(action).setPackage(context.packageName), flags)
        trySend(InstallUpdate(InstallState.INSTALLING))
        p.session.commit(pi.intentSender)
        p.session.close()
        awaitClose { runCatching { context.unregisterReceiver(receiver) } }
    }

    fun abort(transferId: String) {
        pending.remove(transferId)?.session?.abandon()
    }
}
