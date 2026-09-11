package io.nawah.linux.core.runtime

import java.io.File
import java.io.IOException

/**
 * The questions [ProotArgsBuilder] asks about the host filesystem.
 *
 * The proot argv is not a pure function of the request alone: half of the binds
 * exist only when the corresponding host path is there and reachable, and those
 * paths (`/apex`, `/linkerconfig`, `/storage/emulated/0`) exist on a phone and
 * on no build machine. Routing every probe through this interface is what makes
 * the builder testable on the JVM — a fake answers for a device we do not have,
 * and the golden argv test becomes deterministic instead of machine-dependent.
 */
interface FileSystemFacts {
    /** `os.path.exists`: the path resolves, following symlinks. */
    fun exists(path: String): Boolean

    /**
     * `os.path.lexists`: the name exists, *even as a dangling symlink*.
     *
     * Distinct from [exists] on purpose. `/dev/stdout` on Android is a symlink
     * into `/proc/self/fd`; whether it currently resolves is irrelevant — if the
     * name is taken, binding over it is what would break it.
     */
    fun symlinkExists(path: String): Boolean

    fun isDirectory(path: String): Boolean

    fun isFile(path: String): Boolean

    /** True when the file can actually be opened for reading, not merely stat'ed. */
    fun isReadable(path: String): Boolean

    /** Resolves symlinks; returns [path] unchanged when it cannot be resolved. */
    fun realPath(path: String): String

    /**
     * True when the directory carries the world-execute bit (mode `..1`, `..5`,
     * `..7`).
     *
     * proot-distro tests exactly this before binding an Android system
     * directory, because the guest runs under a different uid than the one that
     * owns `/system`: a directory the guest cannot traverse, bound in, produces
     * a confusing `EACCES` deep inside the dynamic linker instead of a missing
     * mount.
     */
    fun isWorldTraversable(path: String): Boolean
}

/**
 * [FileSystemFacts] backed by the real filesystem.
 *
 * The world-execute test goes through `android.system.Os.stat` because
 * `java.nio.file.Files.getPosixFilePermissions` needs API 26 and Nawah's
 * `minSdk` is 24. When `Os` is unavailable (plain JVM, unit tests that
 * accidentally use this object) it degrades to [File.canExecute], which asks
 * the same question for the calling process rather than for "everyone".
 */
object RealFileSystemFacts : FileSystemFacts {
    /** `S_IXOTH` — the world-execute bit. */
    private const val S_IXOTH: Int = 0b1

    override fun exists(path: String): Boolean = File(path).exists()

    override fun symlinkExists(path: String): Boolean {
        val file = File(path)
        // exists() follows links, so a dangling symlink needs the directory
        // listing to be seen at all.
        if (file.exists()) return true
        val parent = file.parentFile ?: return false
        return parent.list()?.contains(file.name) == true
    }

    override fun isDirectory(path: String): Boolean = File(path).isDirectory

    override fun isFile(path: String): Boolean = File(path).isFile

    override fun isReadable(path: String): Boolean = try {
        File(path).inputStream().use { it.read() }
        true
    } catch (_: IOException) {
        false
    } catch (_: SecurityException) {
        false
    }

    override fun realPath(path: String): String = try {
        File(path).canonicalPath
    } catch (_: IOException) {
        path
    }

    override fun isWorldTraversable(path: String): Boolean {
        val mode = statMode(path)
        return if (mode != null) (mode and S_IXOTH) != 0 else File(path).canExecute()
    }

    /** `st_mode`, or null when `android.system.Os` is not on this classpath. */
    private fun statMode(path: String): Int? = try {
        val os = Class.forName("android.system.Os")
        val structStat = os.getMethod("stat", String::class.java).invoke(null, path)
        structStat?.javaClass?.getField("st_mode")?.getInt(structStat)
    } catch (_: ReflectiveOperationException) {
        null
    } catch (_: RuntimeException) {
        // ErrnoException is a RuntimeException-free checked type on Android but
        // arrives wrapped; a failed stat is simply "cannot tell".
        null
    }
}
