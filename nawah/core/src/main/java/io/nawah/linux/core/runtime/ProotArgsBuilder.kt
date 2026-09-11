package io.nawah.linux.core.runtime

import java.io.File

/**
 * Builds the argv for one proot invocation.
 *
 * The recipe is not ours: it is proot-distro 5.8.0's, read from its own source
 * (`commands/login/proot_cmd.py` and `bindings.py`). Every entry below earns
 * its place, and several of them are load-bearing in ways that are invisible
 * until they are missing:
 *
 *  - `--link2symlink`, because Android's filesystem refuses hard links and
 *    `dpkg` uses them constantly. Without it, installing packages fails.
 *  - `--sysvipc`, because Android has no System V IPC and X clients want it.
 *  - `--kill-on-exit`, because otherwise leaving a session strands the whole
 *    guest process tree.
 *  - the `/system`, `/apex` and `/linkerconfig` binds, because the X11 bridge
 *    execs `/system/bin/app_process` *inside* the container. Drop them and the
 *    desktop simply never appears, with no obvious error.
 *
 * The builder is a pure function of its inputs -- filesystem questions go
 * through [FileSystemFacts] -- so the whole thing is unit-testable on a JVM
 * with no device.
 */
object ProotArgsBuilder {

    /** Android system paths bound in when present and traversable. */
    private val SYSTEM_DIRS = listOf(
        "/apex", "/odm", "/product", "/system", "/system_ext", "/vendor",
    )

    private val SYSTEM_FILES = listOf(
        "/linkerconfig/ld.config.txt",
        "/linkerconfig/com.android.art/ld.config.txt",
        "/plat_property_contexts",
        "/property_contexts",
    )

    /** Candidate shared-storage roots, first readable one wins. */
    private val STORAGE_ROOTS = listOf(
        "/storage/self/primary", "/storage/emulated/0", "/sdcard",
    )

    fun build(
        request: ProotRequest,
        facts: FileSystemFacts = RealFileSystemFacts,
        layout: ContainerLayout = FileContainerLayout,
    ): List<String> {
        val args = ArrayList<String>(64)
        args += request.tools.prootBinary.absolutePath

        // ---- extensions ----------------------------------------------------
        args += "--kill-on-exit"
        args += "--link2symlink"
        args += "--sysvipc"
        with(request.kernel) {
            // proot's own escaping: backslash-separated uname fields.
            args += "--kernel-release=\\Linux\\${request.hostname}\\$release\\$version\\$machine\\localdomain\\-1\\"
        }
        // Makes lstat report through symlinks the way dpkg expects.
        args += "-L"

        args += "--change-id=${request.uid}:${request.gid}"
        args += "--rootfs=${request.rootfs.absolutePath}"
        args += "--cwd=${request.cwd}"

        // ---- the three kernel filesystems ----------------------------------
        args += "--bind=/dev"
        args += "--bind=/proc"
        args += "--bind=/sys"

        // ---- device nodes Android does not provide -------------------------
        args += "--bind=/dev/urandom:/dev/random"
        if (!facts.symlinkExists("/dev/fd")) args += "--bind=/proc/self/fd:/dev/fd"
        listOf(0 to "stdin", 1 to "stdout", 2 to "stderr").forEach { (fd, name) ->
            if (!facts.symlinkExists("/dev/$name") && facts.exists("/proc/self/fd/$fd")) {
                args += "--bind=/proc/self/fd/$fd:/dev/$name"
            }
        }

        // ---- /proc and /sys entries Android hides --------------------------
        val stubs = SysData.stubs(request.kernel.release, request.kernel.version)
        val written = layout.prepare(request.containerDir, stubs)
        val sysdata = File(request.containerDir, ContainerDirs.SYSDATA)
        for (stub in stubs) {
            if (stub.fileName in written) {
                args += "--bind=${File(sysdata, stub.fileName).absolutePath}:${stub.guestPath}"
            }
        }
        if (SysData.SYS_EMPTY_DIR in written) {
            // SELinux is present on the host but meaningless to the guest; an
            // empty directory is friendlier than a partially readable one.
            args += "--bind=${File(sysdata, SysData.SYS_EMPTY_DIR).absolutePath}:${SysData.SELINUX_GUEST_PATH}"
        }

        // ---- shared memory -------------------------------------------------
        args += "--bind=${File(request.containerDir, ContainerDirs.SHM).absolutePath}:/dev/shm"

        // ---- Android system, required by app_process (the X11 bridge) ------
        for (path in SYSTEM_DIRS) {
            val real = facts.realPath(path)
            if (facts.isDirectory(real) && facts.isWorldTraversable(real)) args += "--bind=$real"
        }
        for (path in SYSTEM_FILES) {
            val real = facts.realPath(path)
            if (facts.isFile(real) && facts.isReadable(real)) args += "--bind=$real"
        }

        // ---- shared storage, only when the user granted it -----------------
        if (request.bindStorage) args += storageBinds(facts)

        // ---- caller's own binds --------------------------------------------
        for (bind in request.extraBinds) {
            args += if (bind.target != null) "--bind=${bind.source}:${bind.target}" else "--bind=${bind.source}"
        }

        args += request.command
        return args
    }

    private fun storageBinds(facts: FileSystemFacts): List<String> {
        if (facts.isReadable("/storage") || facts.isDirectory("/storage")) {
            val binds = mutableListOf("--bind=/storage")
            if (facts.isDirectory("/storage/emulated/0")) {
                binds += "--bind=/storage/emulated/0:/sdcard"
                binds += "--bind=/storage/emulated/0:/mnt/sdcard"
            }
            return binds
        }
        val root = STORAGE_ROOTS.firstOrNull { facts.isDirectory(it) } ?: return emptyList()
        return listOf(
            "--bind=$root:/mnt/sdcard",
            "--bind=$root:/sdcard",
            "--bind=$root:/storage/emulated/0",
            "--bind=$root:/storage/self/primary",
        )
    }

    /**
     * The environment proot itself is executed with. proot passes it straight
     * through to the guest, so this single map serves two masters -- which is
     * why `LD_*` and `PROOT_*` are set here and never taken from guest data.
     */
    fun environment(request: ProotRequest): Map<String, String> = buildMap {
        put("LD_LIBRARY_PATH", request.tools.nativeLibDir.absolutePath)
        put("PROOT_LOADER", request.tools.prootLoader.absolutePath)
        put("PROOT_TMP_DIR", File(request.containerDir, ContainerDirs.TMP).absolutePath)
        put("HOME", if (request.uid == 0) "/root" else "/home")
        put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
        put("TERM", "xterm-256color")
        put("LANG", "C.UTF-8")
        put("TMPDIR", "/tmp")
        putAll(request.env)
    }
}
