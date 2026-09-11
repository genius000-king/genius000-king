package io.nawah.linux.core.runtime

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * The argv is the contract between this app and proot. These tests exist
 * because every one of the flags below was added for a reason that is invisible
 * at the call site, and a future tidy-up would otherwise remove them silently.
 */
class ProotArgsBuilderTest {

    @get:Rule val tmp = TemporaryFolder()

    private var seq = 0

    /** Nothing on the host exists unless a test says so. */
    private class FakeFacts(
        val existing: Set<String> = emptySet(),
        val dirs: Set<String> = emptySet(),
        val files: Set<String> = emptySet(),
    ) : FileSystemFacts {
        override fun exists(path: String) = path in existing || path in dirs || path in files
        override fun symlinkExists(path: String) = exists(path)
        override fun isDirectory(path: String) = path in dirs
        override fun isFile(path: String) = path in files
        override fun isReadable(path: String) = exists(path)
        override fun realPath(path: String) = path
        override fun isWorldTraversable(path: String) = path in dirs
    }

    private fun request(
        bindStorage: Boolean = false,
        extraBinds: List<Bind> = emptyList(),
        command: List<String> = listOf("/bin/sh", "-lc", "true"),
    ): ProotRequest {
        // Unique per call: several tests build more than one request.
        val n = seq++
        val tools = PathNativeTools(tmp.newFolder("nativeLibs$n"))
        return ProotRequest(
            tools = tools,
            rootfs = tmp.newFolder("rootfs$n"),
            containerDir = tmp.newFolder("container$n"),
            hostname = "nawah",
            bindStorage = bindStorage,
            extraBinds = extraBinds,
            command = command,
        )
    }

    private fun build(req: ProotRequest, facts: FileSystemFacts) =
        ProotArgsBuilder.build(req, facts)

    @Test
    fun `proot binary comes first and the command comes last`() {
        val req = request(command = listOf("/bin/echo", "hello"))
        val args = build(req, FakeFacts())
        assertThat(args.first()).isEqualTo(req.tools.prootBinary.absolutePath)
        assertThat(args.takeLast(2)).containsExactly("/bin/echo", "hello").inOrder()
    }

    @Test
    fun `the extensions Android needs are always present`() {
        val args = build(request(), FakeFacts())
        // link2symlink: Android's filesystem refuses hard links, which dpkg uses.
        // sysvipc: Android has no System V IPC, which X clients expect.
        // kill-on-exit: otherwise leaving a session strands the guest tree.
        assertThat(args).containsAtLeast("--kill-on-exit", "--link2symlink", "--sysvipc", "-L")
    }

    @Test
    fun `kernel release is spelled the way proot escapes uname fields`() {
        val args = build(request(), FakeFacts())
        val release = args.single { it.startsWith("--kernel-release=") }
        assertThat(release).startsWith("--kernel-release=\\Linux\\nawah\\")
        assertThat(release).endsWith("\\localdomain\\-1\\")
    }

    @Test
    fun `dev proc and sys are bound`() {
        val args = build(request(), FakeFacts())
        assertThat(args).containsAtLeast("--bind=/dev", "--bind=/proc", "--bind=/sys")
    }

    @Test
    fun `dev fd is synthesised only when the host does not provide it`() {
        val without = build(request(), FakeFacts(existing = setOf("/proc/self/fd/0")))
        assertThat(without).contains("--bind=/proc/self/fd:/dev/fd")

        val with = build(request(), FakeFacts(existing = setOf("/dev/fd")))
        assertThat(with).doesNotContain("--bind=/proc/self/fd:/dev/fd")
    }

    @Test
    fun `android system paths are bound because app_process lives there`() {
        // Without these the X11 bridge cannot exec /system/bin/app_process and
        // the desktop never appears. See docs/x11-bridge.md.
        val facts = FakeFacts(
            dirs = setOf("/system", "/apex", "/vendor"),
            files = setOf("/linkerconfig/ld.config.txt"),
        )
        val args = build(request(), facts)
        assertThat(args).containsAtLeast(
            "--bind=/system", "--bind=/apex", "--bind=/vendor",
            "--bind=/linkerconfig/ld.config.txt",
        )
    }

    @Test
    fun `android system paths that are absent are skipped`() {
        val args = build(request(), FakeFacts(dirs = setOf("/system")))
        assertThat(args).contains("--bind=/system")
        assertThat(args).doesNotContain("--bind=/vendor")
        assertThat(args).doesNotContain("--bind=/odm")
    }

    @Test
    fun `a system path that is not world-traversable is skipped`() {
        // isWorldTraversable() is false for anything not in `dirs`.
        val facts = object : FileSystemFacts by FakeFacts(dirs = setOf("/system")) {
            override fun isWorldTraversable(path: String) = false
        }
        assertThat(build(request(), facts)).doesNotContain("--bind=/system")
    }

    @Test
    fun `shared storage is bound only when the user granted it`() {
        val facts = FakeFacts(dirs = setOf("/storage", "/storage/emulated/0"))

        val denied = build(request(bindStorage = false), facts)
        assertThat(denied.none { it.contains("/sdcard") }).isTrue()

        val granted = build(request(bindStorage = true), facts)
        assertThat(granted).contains("--bind=/storage/emulated/0:/sdcard")
    }

    @Test
    fun `fake proc entries are bound over the ones Android hides`() {
        val args = build(request(), FakeFacts())
        val targets = args.filter { it.startsWith("--bind=") }.map { it.substringAfterLast(':') }
        assertThat(targets).containsAtLeast(
            "/proc/stat", "/proc/version", "/proc/loadavg", "/proc/uptime", "/proc/vmstat",
        )
    }

    @Test
    fun `shm comes from the container directory, never from inside the rootfs`() {
        // A guest can write anywhere in its own rootfs, so binding a path from
        // there would let it point /dev/shm at a host directory of its choosing.
        val req = request()
        val args = build(req, FakeFacts())
        val shm = args.single { it.endsWith(":/dev/shm") }
        assertThat(shm).contains(req.containerDir.absolutePath)
        assertThat(shm).doesNotContain(req.rootfs.absolutePath + "/")
    }

    @Test
    fun `caller binds are appended after ours`() {
        val args = build(request(extraBinds = listOf(Bind("/tmp/x", "/mnt/x"))), FakeFacts())
        val index = args.indexOf("--bind=/tmp/x:/mnt/x")
        assertThat(index).isGreaterThan(args.indexOf("--bind=/dev"))
    }

    @Test
    fun `environment points proot at its own loader and our library directory`() {
        val req = request()
        val env = ProotArgsBuilder.environment(req)
        // The loader must be a real file: proot's usual trick of extracting it
        // at runtime would land in the data directory, which is not executable.
        assertThat(env["PROOT_LOADER"]).isEqualTo(req.tools.prootLoader.absolutePath)
        assertThat(env["LD_LIBRARY_PATH"]).isEqualTo(req.tools.nativeLibDir.absolutePath)
        assertThat(env["PROOT_TMP_DIR"]).contains(req.containerDir.name)
        assertThat(env["HOME"]).isEqualTo("/root")
    }

    @Test
    fun `caller environment can add but the loader path is ours`() {
        val req = request().copy(env = mapOf("DISPLAY" to ":0"))
        val env = ProotArgsBuilder.environment(req)
        assertThat(env["DISPLAY"]).isEqualTo(":0")
        assertThat(env).containsKey("PROOT_LOADER")
    }

    @Test
    fun `the argv is stable across builds`() {
        val req = request()
        assertThat(build(req, FakeFacts())).isEqualTo(build(req, FakeFacts()))
    }

    @Test
    fun `container layout is created on disk`() {
        val req = request()
        build(req, FakeFacts())
        assertThat(File(req.containerDir, ContainerDirs.SHM).isDirectory).isTrue()
        assertThat(File(req.containerDir, ContainerDirs.SYSDATA).isDirectory).isTrue()
    }
}
