package com.genius.tvhub.core.common

/**
 * Logging without Android. Engines log through [Log]; the app installs an Android sink at
 * startup, tests leave the default (stdout) or install a recorder.
 */
fun interface LogSink {
    fun write(level: Log.Level, tag: String, message: String, error: Throwable?)
}

object Log {
    enum class Level { DEBUG, INFO, WARN, ERROR }

    @Volatile var sink: LogSink = LogSink { level, tag, message, error ->
        println("${level.name.first()}/$tag: $message" + (error?.let { " — $it" } ?: ""))
    }

    fun d(tag: String, message: String) = sink.write(Level.DEBUG, tag, message, null)
    fun i(tag: String, message: String) = sink.write(Level.INFO, tag, message, null)
    fun w(tag: String, message: String, error: Throwable? = null) = sink.write(Level.WARN, tag, message, error)
    fun e(tag: String, message: String, error: Throwable? = null) = sink.write(Level.ERROR, tag, message, error)
}
