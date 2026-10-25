package com.genius.tvhub.engine.monitor.collect

import java.io.File

/** Reading kernel files, behind an interface so tests can supply their own. */
fun interface SysFs {
    fun read(path: String): String?

    companion object {
        /** Reads if readable; SELinux denials and missing files are both just null. */
        val Real = SysFs { path -> runCatching { File(path).takeIf { it.canRead() }?.readText() }.getOrNull() }
    }
}
