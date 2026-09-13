package io.nawah.linux.core.provision

import io.nawah.linux.core.model.Machine
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroSpec
import io.nawah.linux.core.model.LocalizedText
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
    private val arch: OciArch,
    /** Resolves a machine's desktop id against the catalog. */
    private val desktopFor: (String) -> DesktopSpec?,
    /** Resolves a machine's distribution id against the catalog. */
    private val distroFor: (String) -> DistroSpec?,
) : Provisioner {

    private val guestFiles = GuestFileWriter(store)

    private val FALLBACK_DESKTOP = DesktopSpec(
        id = "none",
        name = LocalizedText.of("Command line only"),
        packages = emptyList(),
        startCommand = "",
        installedBytes = 0,
    )

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
            val packages = (BASE_PACKAGES + request.desktop.packages + request.appPackages).distinct()
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

            // 6 -- the session script. Small, generated, and rewritten on every
            // launch as well; see GuestFileWriter for why that matters.
            step = InstallStep.INSTALLING_X11_BRIDGE
            send(InstallProgress.Running(InstallStep.INSTALLING_X11_BRIDGE))
            guestFiles.install(machine, request.desktop)
            emitLine(InstallStep.INSTALLING_X11_BRIDGE, "installed ${GuestScripts.SESSION_PATH}")
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

    /**
     * Adds packages to an installed machine. See [Provisioner.installApps].
     *
     * Reported through the same [InstallProgress] the first install uses, so
     * the screen that shows it needs no second shape — but only one step is
     * ever reached, because nothing here downloads an image or unpacks a
     * filesystem.
     */
    override fun installApps(
        machineId: String,
        appIds: List<String>,
        packages: List<String>,
    ): Flow<InstallProgress> = channelFlow {
        val machine = store.get(machineId)
        if (machine == null || packages.isEmpty()) {
            send(InstallProgress.Failed(InstallStep.INSTALLING_PACKAGES, "no such system", ""))
            return@channelFlow
        }
        val request = machine.toInstallRequest()
        val step = InstallStep.INSTALLING_PACKAGES
        send(InstallProgress.Running(step))
        try {
            if (aptListsAreStale(machineId)) {
                runGuestChecked(machineId, request, "apt-get update") {
                    send(InstallProgress.Running(step, line = it))
                }
            }
            runGuestChecked(
                machineId, request,
                "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
                    "--no-install-recommends ${packages.joinToString(" ")}",
            ) { send(InstallProgress.Running(step, line = it)) }

            val updated = machine.copy(appIds = (machine.appIds + appIds).distinct())
            store.put(updated)
            send(InstallProgress.Done(updated))
        } catch (e: Throwable) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            send(
                InstallProgress.Failed(
                    step,
                    e.message ?: e::class.java.simpleName,
                    "",
                ),
            )
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Enough of an [InstallRequest] to run a command in an existing machine.
     *
     * The runtime only reads the distro's identity and the machine's own
     * settings from it; the download and desktop fields are never consulted
     * once a rootfs exists.
     */
    private fun Machine.toInstallRequest(): InstallRequest = InstallRequest(
        machineId = id,
        name = name,
        distro = requireNotNull(distroFor(distroId)) { "unknown distribution $distroId" },
        desktop = desktopFor(desktopId) ?: FALLBACK_DESKTOP,
        profile = profile,
        permissions = permissions,
        displayScalePercent = displayScalePercent,
    )

    override suspend fun remove(machineId: String) = store.delete(machineId)

    /**
     * Rewrites the machine's app-owned files.
     *
     * Far less load-bearing than it once was: the guest no longer holds a
     * signed `loader.apk` that a rebuild could invalidate. It stays because a
     * rootfs whose session script was damaged is otherwise unrecoverable
     * except by reinstalling.
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

    /** See [AptSources] — the decision, and why it is not a per-distro branch. */
    private fun writeAptSources(id: String, request: InstallRequest) {
        val rootfs = store.rootfsDir(id)
        val plan = AptSources.plan(rootfs, request.distro)
        if (plan.deleteLegacyList) File(rootfs, "etc/apt/sources.list").delete()
        plan.write?.let { writeGuestFile(id, "/etc/apt/sources.list", it) }
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
        displayScalePercent = displayScalePercent,
        appIds = appIds,
        createdAtEpochMs = System.currentTimeMillis(),
        state = state,
    )

    internal companion object {
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
            // xkb-data: no keyboard map, no X server -- it exits on startup.
            // xfonts-base: supplies the core font "fixed" and the cursor font.
            //   Without it the server aborts with "could not open default
            //   font", which reaches the user as a black screen and nothing
            //   else. GuestPrerequisites re-checks both at every launch.
            "dbus-x11", "xkb-data", "xfonts-base", "x11-xserver-utils", "xterm",
            "locales", "ca-certificates", "procps",
        )
    }
}

private fun String.hostname(): String =
    map { if (it.isLetterOrDigit() && it.code < 128) it else '-' }
        .joinToString("").trim('-').take(32).ifEmpty { "nawah" }
