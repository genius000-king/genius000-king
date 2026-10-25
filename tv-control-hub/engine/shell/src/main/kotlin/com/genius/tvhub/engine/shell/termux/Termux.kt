package com.genius.tvhub.engine.shell.termux

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.content.ContextCompat
import com.genius.tvhub.core.model.CommandResult
import com.genius.tvhub.core.protocol.ErrorCode
import com.genius.tvhub.core.protocol.RemoteException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.atomic.AtomicInteger

/** Something that runs a bash command and returns its result: Termux on the TV, bash in tests. */
fun interface CommandRunner {
    suspend fun run(command: String, timeoutMillis: Long): CommandResult
}

/** Termux's RUN_COMMAND contract, as data. */
object TermuxContract {
    const val PACKAGE = "com.termux"
    const val SERVICE = "com.termux.app.RunCommandService"
    const val ACTION = "com.termux.RUN_COMMAND"
    const val PERMISSION = "com.termux.permission.RUN_COMMAND"
    const val BASH = "/data/data/com.termux/files/usr/bin/bash"
    const val HOME = "/data/data/com.termux/files/home"

    /** The one line typed once in Termux so other apps may run commands there. */
    const val ENABLE_LINE = "mkdir -p ~/.termux && echo 'allow-external-apps=true' >> ~/.termux/termux.properties"

    fun parseResult(result: Bundle?): CommandResult {
        val r = result ?: return CommandResult(-1, "", "no result from Termux", 0, false)
        val err = r.getInt("err", -1)
        val errmsg = r.getString("errmsg").orEmpty()
        val exit = r.getInt("exitCode", if (err == -1) 0 else -1)
        val stdout = r.getString("stdout").orEmpty()
        val stderr = listOf(r.getString("stderr").orEmpty(), if (err > 0) errmsg else "").filter { it.isNotBlank() }.joinToString("\n")
        val original = r.getString("stdout_original_length")?.toIntOrNull() ?: 0
        return CommandResult(exit, stdout, stderr, 0, original > stdout.length)
    }
}

/** Runs commands in Termux through its RUN_COMMAND service and waits for the result. */
class TermuxBridge(private val context: Context) : CommandRunner {
    private val ids = AtomicInteger(1)

    fun installed() = runCatching { context.packageManager.getPackageInfo(TermuxContract.PACKAGE, 0) }.isSuccess

    fun permitted() = ContextCompat.checkSelfPermission(context, TermuxContract.PERMISSION) == PackageManager.PERMISSION_GRANTED

    override suspend fun run(command: String, timeoutMillis: Long): CommandResult {
        if (!installed()) throw RemoteException(ErrorCode.UNAVAILABLE, "Termux is not installed on the TV")
        if (!permitted()) throw RemoteException(ErrorCode.UNAVAILABLE, "TV Hub needs the Termux RUN_COMMAND permission")
        val id = ids.getAndIncrement()
        val action = "${context.packageName}.TERMUX_RESULT_$id"
        val deferred = CompletableDeferred<CommandResult>()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                deferred.complete(TermuxContract.parseResult(i.getBundleExtra("result")))
            }
        }
        ContextCompat.registerReceiver(context, receiver, IntentFilter(action), ContextCompat.RECEIVER_EXPORTED)
        val started = System.currentTimeMillis()
        try {
            val flags = PendingIntent.FLAG_ONE_SHOT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            val pi = PendingIntent.getBroadcast(context, id, Intent(action).setPackage(context.packageName), flags)
            val intent = Intent(TermuxContract.ACTION).setClassName(TermuxContract.PACKAGE, TermuxContract.SERVICE)
                .putExtra("com.termux.RUN_COMMAND_PATH", TermuxContract.BASH)
                .putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arrayOf("-lc", command))
                .putExtra("com.termux.RUN_COMMAND_WORKDIR", TermuxContract.HOME)
                .putExtra("com.termux.RUN_COMMAND_BACKGROUND", true)
                .putExtra("com.termux.RUN_COMMAND_PENDING_INTENT", pi)
            context.startService(intent)
            val result = withTimeoutOrNull(timeoutMillis) { deferred.await() }
                ?: throw RemoteException(ErrorCode.TIMEOUT, "Termux did not answer in ${timeoutMillis / 1000}s (is allow-external-apps on?)")
            return result.copy(durationMillis = System.currentTimeMillis() - started)
        } finally {
            runCatching { context.unregisterReceiver(receiver) }
        }
    }
}
