package io.nawah.linux

import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Records the last uncaught exception where the app can read it back.
 *
 * An install takes twenty minutes and the user is usually not watching. When
 * the process dies, everything that would explain it — the stack trace, the
 * thread — is gone by the time anyone opens the app again, and all that is left
 * is "it threw me out". This writes it down first.
 *
 * It is deliberately tiny and allocation-light: it runs on a thread that is
 * already dying, possibly because memory ran out.
 */
object CrashLog {

    private const val FILE = "last-crash.txt"

    fun install(context: Context) {
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { write(appContext, thread, error) }
            previous?.uncaughtException(thread, error)
        }
    }

    fun read(context: Context): String? =
        file(context).takeIf { it.isFile }?.runCatching { readText() }?.getOrNull()

    fun clear(context: Context) {
        file(context).delete()
    }

    private fun file(context: Context) = File(context.filesDir, FILE)

    private fun write(context: Context, thread: Thread, error: Throwable) {
        val stack = StringWriter().also { error.printStackTrace(PrintWriter(it)) }
        val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
        file(context).writeText(
            buildString {
                appendLine("time: $stamp")
                appendLine("thread: ${thread.name}")
                appendLine("device: ${Build.MANUFACTURER} ${Build.MODEL}, API ${Build.VERSION.SDK_INT}")
                appendLine("abi: ${Build.SUPPORTED_ABIS.joinToString()}")
                appendLine()
                append(stack.toString())
            },
        )
    }
}
