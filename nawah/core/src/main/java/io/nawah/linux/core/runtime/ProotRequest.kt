package io.nawah.linux.core.runtime

import java.io.File

/**
 * One `--bind=source[:target]` entry supplied by a caller.
 *
 * [target] is optional because proot treats a bind with no target as
 * source-onto-itself, which is what you want for host paths that must keep
 * their name inside the guest (`/system`, `/apex`).
 */
data class Bind(val source: String, val target: String? = null)

/**
 * What `uname` reports inside the guest.
 *
 * Android's real kernel release carries a vendor suffix
 * (`5.10.101-android12-9-00001-g...`) that Debian tooling parses and chokes on,
 * and the version string it exposes leaks device identity. proot's Termux-only
 * `--kernel-release` extension replaces the whole `utsname` tuple, so we pin a
 * plain upstream-looking kernel and keep `/proc/version` (see [SysData])
 * telling the same story.
 */
data class KernelIdentity(
    val release: String = SysData.DEFAULT_KERNEL_RELEASE,
    val version: String = SysData.DEFAULT_KERNEL_VERSION,
    /** `uname -m`. Must match the ABI the proot binary was built for. */
    val machine: String = SysData.DEFAULT_UNAME_MACHINE,
)

/**
 * Everything needed to launch one proot command.
 *
 * A value type on purpose: [ProotArgsBuilder] turns it into an argv with no
 * hidden state, which is what makes the argv testable against a golden file.
 */
data class ProotRequest(
    val tools: NativeTools,
    /** The guest's `/`. */
    val rootfs: File,
    /** Sibling of [rootfs]; holds `shm/`, `tmp/` and the fake `/proc` stubs. */
    val containerDir: File,
    /** Working directory *inside* the guest. */
    val cwd: String = "/root",
    val uid: Int = 0,
    val gid: Int = 0,
    val hostname: String = "nawah",
    /** Binds Android shared storage into the guest. Gated on a user permission. */
    val bindStorage: Boolean = false,
    val extraBinds: List<Bind> = emptyList(),
    /** Merged over the runtime's defaults by `ProcessProotRunner`. */
    val env: Map<String, String> = emptyMap(),
    /** The command to run inside the guest, e.g. `["/bin/bash", "-lc", "apt update"]`. */
    val command: List<String>,
    /**
     * Additive to the shared contract: the fake `utsname` the guest sees.
     * Defaulted, so callers written against `docs/CONTRACTS.md` are unaffected.
     */
    val kernel: KernelIdentity = KernelIdentity(),
)

/** Exit status and combined (stdout + stderr) output of a finished proot run. */
data class ProotResult(val exitCode: Int, val output: String) {
    val isSuccess: Boolean get() = exitCode == 0
}
