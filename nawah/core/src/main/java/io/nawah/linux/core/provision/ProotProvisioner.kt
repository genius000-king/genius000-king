package io.nawah.linux.core.provision

import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.MachineState
import io.nawah.linux.core.oci.OciArch
import io.nawah.linux.core.oci.OciClient
import io.nawah.linux.core.oci.PullEvent
import io.nawah.linux.core.runtime.Bind
import io.nawah.linux.core.runtime.NativeTools
import io.nawah.linux.core.runtime.ProotRequest
import io.nawah.linux.core.runtime.ProotRunner
import io.nawah.linux.core.store.MachineStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.io.File
import java.io.IOException
import java.io.InputStream

/**
 * Turns an [InstallRequest] into a working Debian machine.
 *
 * Two decisions here are not stylistic:
 *
 *  1. The rootfs is unpacked **through proot**, by busybox running inside it.
 *     A tarball from a container registry is full of hard links and device
 *     nodes; Android's filesystem allows neither. `--link2symlink` turns the
 *     hard links into something that survives, and without it `apt` fails
 *     later in ways that look nothing like an extraction bug.
 *  2. apt's `_apt` sandbox user is disabled. It drops privileges to a user
 *     that cannot traverse a proot rootfs, so every download fails with a
 *     permission error that blames the mirror.
 */
class ProotProvisioner(
    private val store: MachineStore,
    private val runner: ProotRunner,
    private val tools: NativeTools,
    private val oci: OciClient,
    private val applicationId: String,
    private val arch: OciArch,
    /** Reads a file out of the app's assets. Injected so the pipeline stays testable. */
    private val openAsset: (String) -> InputStream,
    /** Resolves a machine's desktop id against the catalog. */
    private val desktopFor: (String) -> DesktopSpec?,
) : Provisioner {

    private val guestFiles = GuestFileWriter(store, applicationId, openAsset)

    override fun resume(machineId: String): Flow<InstallProgress>? {
        val checkpoint = InstallCheckpoint.load(store.machineDir(machineId)) ?: return null
        return install(checkpoint.request)
    }

    /**
     * channelFlow, not flow.
     *
     * `ProotRunner.exec` reads the child's output inside its own
     * `withContext(IO)` and calls back per line, so the emission that the line
     * triggers happens in a *different coroutine* than this builder. `flow {}`
     * forbids that outright — "Flow invariant is violated" — and the exception
     * escaped collect and killed the process the first time any command ran
     * through proot. channelFlow exists for exactly this shape.
     */
    override fun install(request: InstallRequest): Flow<InstallProgress> = channelFlow {
        val id = request.machineId
        val log = store.logFile(id)
        val dir = store.machineDir(id).apply { mkdirs() }

        // Resume rather than restart. A checkpoint from a previous attempt is
        // only trusted when it describes the same machine and the same choices.
        var checkpoint = InstallCheckpoint.load(dir)
            ?.takeIf { it.request.machineId == request.machineId && it.request == request }
            ?: InstallCheckpoint(request)
        InstallCheckpoint.save(dir, checkpoint)

        suspend fun finish(step: InstallStep) {
            checkpoint = checkpoint.withCompleted(step)
            InstallCheckpoint.save(dir, checkpoint)
        }

        // Appended to, not truncated: the log of the attempt that failed is
        // what explains why this one is happening.
        if (!log.isFile) log.writeText("")
        if (checkpoint.completed.isNotEmpty()) {
            log.appendText("--- resuming after ${checkpoint.completed.joinToString { it.name }}\n")
        }

        suspend fun emitLine(step: InstallStep, line: String) {
            log.appendText(line + "\n")
            send(InstallProgress.Running(step, null, line))
        }

        var machine = request.toMachine(MachineState.INSTALLING)
        store.put(machine)

        var step = InstallStep.DOWNLOADING
        try {
            // 1 + 2 -- download, with the digest verified while streaming. The
            // client keeps a .part file and asks the registry to continue from
            // it, so a dropped connection costs seconds rather than the blob.
            val tarball = File(dir, "rootfs.tar.gz")
            if (!checkpoint.isDone(InstallStep.VERIFYING) && !tarball.isFile) {
                oci.pullLayer(request.distro.image, arch, tarball).collect { event ->
                    when (event) {
                        is PullEvent.Progress -> send(
                            InstallProgress.Running(InstallStep.DOWNLOADING, event.fraction),
                        )
                        is PullEvent.Completed -> emitLine(
                            InstallStep.VERIFYING,
                            "verified ${event.layer.digest} (${event.file.length()} bytes)",
                        )
                    }
                }
            }
            send(InstallProgress.Running(InstallStep.VERIFYING, 1f))
            finish(InstallStep.DOWNLOADING)
            finish(InstallStep.VERIFYING)

            // 3 -- unpack, on this side of the container. Doing it through
            // proot means proot resolves the unpacking command inside a rootfs
            // that is still empty, which cannot work.
            step = InstallStep.EXTRACTING
            currentCoroutineContext().ensureActive()
            val rootfs = store.rootfsDir(id)
            rootfs.mkdirs()
            if (checkpoint.isDone(step)) {
                send(InstallProgress.Running(step, 1f))
            } else {
            // No progress callback: the layer is ~50 MB and unpacks in seconds,
            // so an indeterminate bar is more honest than a bar that jumps.
            val extracted = RootfsExtractor.extract(tarball, rootfs)
            send(InstallProgress.Running(InstallStep.EXTRACTING, 1f))
            emitLine(
                InstallStep.EXTRACTING,
                "unpacked ${extracted.files} files, ${extracted.directories} directories, " +
                    "${extracted.symlinks} symlinks, ${extracted.hardLinksCopied} hard links copied, " +
                    "${extracted.skipped} skipped",
            )
            require(File(rootfs, "bin/sh").exists() || File(rootfs, "usr/bin/sh").exists()) {
                "the unpacked image has no /bin/sh; it is not a usable rootfs"
            }
            tarball.delete()
            finish(step)
            }

            // 4 -- guest configuration, written from this side. Cheap and
            // idempotent, so it is redone on every resume rather than skipped.
            step = InstallStep.BOOTSTRAPPING
            send(InstallProgress.Running(InstallStep.BOOTSTRAPPING))
            writeBaseConfig(id, request)
            emitLine(InstallStep.BOOTSTRAPPING, "wrote resolv.conf, hosts, sources.list, apt config")
            finish(step)

            // 5 -- the long one. Every command must actually succeed. apt keeps
            // its own state in dpkg, so re-running after an interruption picks
            // up where it stopped instead of re-fetching what it already has.
            step = InstallStep.INSTALLING_PACKAGES
            val packages = (BASE_PACKAGES + request.desktop.packages).distinct()
            // ~10 MB of index. Re-downloading it on every retry is the kind of
            // waste a user on mobile data notices.
            if (aptListsAreStale(id)) {
                runGuestChecked(id, request, "apt-get update") {
                    emitLine(InstallStep.INSTALLING_PACKAGES, it)
                }
            } else {
                emitLine(InstallStep.INSTALLING_PACKAGES, "package lists are current, skipping update")
            }
            if (packages.isNotEmpty()) {
                runGuestChecked(
                    id, request,
                    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
                        "--no-install-recommends ${packages.joinToString(" ")}",
                ) { emitLine(InstallStep.INSTALLING_PACKAGES, it) }
            }
            finish(step)

            // 6 -- the X11 bridge.
            step = InstallStep.INSTALLING_X11_BRIDGE
            send(InstallProgress.Running(InstallStep.INSTALLING_X11_BRIDGE))
            guestFiles.install(machine, request.desktop)
            emitLine(InstallStep.INSTALLING_X11_BRIDGE, "installed ${GuestScripts.BRIDGE_PATH}")
            finish(step)

            // 7 -- session script and hand-over.
            step = InstallStep.CONFIGURING
            send(InstallProgress.Running(InstallStep.CONFIGURING))
            // The session script is also written here, but it is rewritten on
            // every launch too -- see GuestFileWriter.

            finish(step)
            machine = machine.copy(state = MachineState.READY)
            store.put(machine)
            InstallCheckpoint.clear(dir)
            send(InstallProgress.Done(machine))
        } catch (e: Throwable) {
            // NonCancellable: when the cause *is* cancellation, an ordinary
            // suspend call here would be cancelled too and the machine would be
            // left recorded as INSTALLING for ever.
            withContext(NonCancellable) { store.put(machine.copy(state = MachineState.FAILED)) }
            val tail = log.takeIf { it.isFile }?.readText().orEmpty().takeLast(8_000)
            if (e is kotlinx.coroutines.CancellationException) {
                // The terminal state for a cancellation is published by the
                // caller: emitting from a cancelled flow throws instead.
                throw e
            }
            send(
                InstallProgress.Failed(
                    step = step,
                    message = e.message ?: e::class.java.simpleName,
                    log = tail,
                ),
            )
        }
    }.flowOn(Dispatchers.IO)

    override suspend fun remove(machineId: String) = store.delete(machineId)

    /**
     * Re-installs the guest half of the X11 bridge.
     *
     * Needed whenever the app is rebuilt with a different signing key: the
     * `loader.apk` already inside a rootfs carries the old certificate hash and
     * will refuse to load the new app.
     */
    override suspend fun repairX11Bridge(machineId: String) {
        val machine = store.get(machineId) ?: return
        guestFiles.refresh(machine, desktopFor(machine.desktopId))
        store.get(machineId)
            ?.takeIf { it.state == MachineState.NEEDS_REPAIR }
            ?.let { store.put(it.copy(state = MachineState.READY)) }
    }

    // -- internals ----------------------------------------------------------

    private fun writeBaseConfig(id: String, request: InstallRequest) {
        val hostname = request.name.hostname()
        writeGuestFile(id, "/etc/resolv.conf", request.dnsServers.joinToString("\n") { "nameserver $it" } + "\n")
        writeGuestFile(id, "/etc/hostname", "$hostname\n")
        writeGuestFile(id, "/etc/hosts", "127.0.0.1 localhost $hostname\n::1 localhost ip6-localhost\n")
        writeAptSources(id, request)
        writeGuestFile(
            id, "/etc/apt/apt.conf.d/99nawah",
            // The sandbox user cannot traverse a proot rootfs; leaving it on
            // makes every download fail as if the mirror were unreachable.
            """
            APT::Sandbox::User "root";
            Acquire::Retries "3";
            Dpkg::Options { "--force-confold"; };
            APT::Install-Recommends "false";
            """.trimIndent() + "\n",
        )
        File(store.rootfsDir(id), "root").mkdirs()
        File(store.rootfsDir(id), "tmp").apply { mkdirs(); setWritable(true, false) }
    }

    /**
     * Leaves the image's own apt sources alone when it has them.
     *
     * A modern Debian image ships `/etc/apt/sources.list.d/debian.sources` in
     * deb822 format, already pointing at main plus the security suite. Writing
     * a second, older-style `sources.list` on top of it does not add anything —
     * it makes apt fetch every target twice and warn about each one. The legacy
     * file is only written when the image has no sources at all.
     */
    private fun writeAptSources(id: String, request: InstallRequest) {
        val rootfs = store.rootfsDir(id)
        val deb822 = File(rootfs, "etc/apt/sources.list.d/debian.sources")
        val legacy = File(rootfs, "etc/apt/sources.list")
        if (deb822.isFile) {
            // Remove one an earlier attempt of ours may have left behind.
            legacy.delete()
            return
        }
        writeGuestFile(
            id, "/etc/apt/sources.list",
            "deb ${request.distro.aptMirror} ${request.distro.codename} " +
                "main contrib non-free non-free-firmware\n" +
                "deb ${request.distro.aptMirror} ${request.distro.codename}-updates " +
                "main contrib non-free non-free-firmware\n",
        )
    }

    private fun writeGuestFile(id: String, guestPath: String, content: String, executable: Boolean = false) {
        val file = File(store.rootfsDir(id), guestPath.trimStart('/'))
        file.parentFile?.mkdirs()
        file.writeText(content)
        if (executable) file.setExecutable(true, false)
    }

    /**
     * Runs a shell command inside the container and fails if it fails.
     *
     * The command is resolved by proot *inside the rootfs*, so it must be a
     * guest path. `/bin/sh` exists only after extraction, which is why nothing
     * before that step goes through here.
     */
    private suspend fun runGuestChecked(
        id: String,
        request: InstallRequest,
        script: String,
        onLine: suspend (String) -> Unit,
    ) {
        val req = ProotRequest(
            tools = tools,
            rootfs = store.rootfsDir(id),
            containerDir = store.containerDir(id),
            cwd = "/",
            hostname = request.name.hostname(),
            bindStorage = false,
            extraBinds = emptyList<Bind>(),
            command = listOf("/bin/sh", "-c", script),
        )
        val lastLines = ArrayDeque<String>()
        val code = runner.exec(req) { line ->
            lastLines.addLast(line)
            while (lastLines.size > 12) lastLines.removeFirst()
            onLine(line)
        }
        if (code != 0) {
            throw IOException(
                "command failed inside the container (exit $code): " +
                    script.take(60) + "\n" + lastLines.joinToString("\n"),
            )
        }
    }

    /** True when apt has no package lists, or they are older than a day. */
    private fun aptListsAreStale(id: String): Boolean {
        val lists = File(store.rootfsDir(id), "var/lib/apt/lists")
        val newest = lists.listFiles()
            ?.filter { it.isFile && it.name.endsWith("_Packages") }
            ?.maxOfOrNull { it.lastModified() }
            ?: return true
        return System.currentTimeMillis() - newest > APT_LIST_MAX_AGE_MS
    }

    private fun InstallRequest.toMachine(state: MachineState) = Machine(
        id = machineId,
        name = name,
        distroId = distro.id,
        desktopId = desktop.id,
        profile = profile,
        permissions = permissions,
        displayWidth = displayWidth,
        displayHeight = displayHeight,
        createdAtEpochMs = System.currentTimeMillis(),
        state = state,
    )

    internal companion object {
        const val ASSET_LOADER = "x11/loader.apk"
        const val APT_LIST_MAX_AGE_MS = 24L * 60 * 60 * 1000

        /**
         * Always present: the bridge and any desktop depend on these.
         *
         * These are **binary** package names. `xkeyboard-config` was here once
         * and broke every install with "Unable to locate package" — it is the
         * *source* package; the binary Debian ships is `xkb-data`. The names
         * are pinned by BasePackagesTest against the real trixie index.
         */
        val BASE_PACKAGES = listOf(
            "dbus-x11", "xkb-data", "x11-xserver-utils", "xterm",
            "locales", "ca-certificates", "procps",
        )
    }
}

private fun String.hostname(): String =
    map { if (it.isLetterOrDigit() && it.code < 128) it else '-' }
        .joinToString("").trim('-').take(32).ifEmpty { "nawah" }
