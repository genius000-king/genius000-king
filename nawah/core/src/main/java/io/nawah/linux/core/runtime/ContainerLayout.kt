package io.nawah.linux.core.runtime

import java.io.File
import java.io.IOException

/**
 * Names of the directories Nawah keeps beside a machine's rootfs.
 *
 * They are siblings of the rootfs, never inside it, for one specific reason:
 * proot resolves a bind *source* by name at mount time, and the guest can write
 * anywhere in its own `/`. A `shm` directory living inside the rootfs could be
 * replaced by the guest with a symlink between two sessions, and the next
 * session would dutifully bind whatever it pointed at into `/dev/shm`.
 */
object ContainerDirs {
    /** Bound to `/dev/shm`. Android's real `/dev` has no usable shm. */
    const val SHM: String = "shm"

    /** `PROOT_TMP_DIR` — proot's own scratch space, not the guest's `/tmp`. */
    const val TMP: String = "tmp"

    /** Holds the fake `/proc` files; see [SysData]. */
    const val SYSDATA: String = "sysdata"
}

/**
 * Creates the host-side directories a proot session needs and reports what it
 * managed to create.
 *
 * Separated from [ProotArgsBuilder] so the builder stays a pure function: the
 * builder asks what exists, this decides what to make. Tests substitute a fake
 * and never touch a disk.
 */
interface ContainerLayout {
    /**
     * Ensures `shm/`, `tmp/` and `sysdata/` exist under [containerDir] and that
     * every [SysData] stub is present.
     *
     * @return the set of names under `sysdata/` that are actually available to
     *   bind — the stub file names plus [SysData.SYS_EMPTY_DIR]. A name missing
     *   from the set is left unbound rather than bound to nothing, because
     *   proot treats a missing bind source as a fatal error and one unreadable
     *   `/proc` stub is not worth failing a boot over.
     */
    fun prepare(containerDir: File, stubs: List<SysDataStub>): Set<String>
}

/**
 * [ContainerLayout] that writes to the real filesystem.
 *
 * A stub is rewritten whenever what is on disk is not a plain file: the
 * directory is writable by the guest through `/dev/shm`'s neighbourhood, and an
 * entry of the wrong type there is something that was planted, not something we
 * wrote. Content that is already correct is left alone so a rerun is cheap.
 */
object FileContainerLayout : ContainerLayout {
    override fun prepare(containerDir: File, stubs: List<SysDataStub>): Set<String> {
        containerDir.mkdirs()
        File(containerDir, ContainerDirs.SHM).mkdirs()
        File(containerDir, ContainerDirs.TMP).mkdirs()

        val sysdata = File(containerDir, ContainerDirs.SYSDATA)
        if (!sysdata.isDirectory && !sysdata.mkdirs()) return emptySet()

        val available = LinkedHashSet<String>()
        val sysEmpty = File(sysdata, SysData.SYS_EMPTY_DIR)
        if (sysEmpty.isDirectory || sysEmpty.mkdirs()) available += SysData.SYS_EMPTY_DIR

        for (stub in stubs) {
            if (writeStub(sysdata, stub)) available += stub.fileName
        }
        return available
    }

    private fun writeStub(sysdata: File, stub: SysDataStub): Boolean {
        val target = File(sysdata, stub.fileName)
        return try {
            if (target.isFile && target.readText() == stub.content) return true
            if (target.exists() && !target.isFile) target.deleteRecursively()
            target.writeText(stub.content)
            true
        } catch (_: IOException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
}
