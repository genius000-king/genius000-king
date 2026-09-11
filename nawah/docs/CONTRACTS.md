# Shared contracts

These types are the seams between the parts of the app. They are written down
here because several people (and several agents) build against them in
parallel: the contract is fixed first, the implementations follow.

Package root: `io.nawah.linux.core`

---

## `io.nawah.linux.core.model`

```kotlin
/** A Linux distribution the app knows how to install. Data, never code. */
@Serializable
data class DistroSpec(
    val id: String,                 // "debian-trixie"
    val name: String,               // "Debian 13"
    val codename: String,           // "trixie"
    /** OCI image reference pulled from the registry, e.g. "library/debian:trixie". */
    val image: String,
    /** Compressed rootfs size in bytes, for the storage estimate shown to the user. */
    val downloadBytes: Long,
    /** Bytes the base rootfs occupies once extracted. */
    val installedBytes: Long,
    val aptMirror: String,
    val enabled: Boolean = true,
)

/** A desktop environment. Adding KDE or LXQt is a new entry here, nothing more. */
@Serializable
data class DesktopSpec(
    val id: String,                 // "xfce4"
    val name: String,               // "XFCE 4"
    val packages: List<String>,     // apt package names
    /** Command run inside the guest once X is up, e.g. "startxfce4". */
    val startCommand: String,
    /** Extra installed bytes on top of the base rootfs. */
    val installedBytes: Long,
    val enabled: Boolean = true,
)

/** How much of the device we let a machine use. Honest about what proot can do. */
enum class ResourceProfile { LIGHT, BALANCED, FULL }

/** Per-machine Android-side permissions, each mapped to a real bind or service. */
@Serializable
data class MachinePermissions(
    val audioOut: Boolean = true,   // PulseAudio sink on the Android side
    val microphone: Boolean = false,// needs RECORD_AUDIO
    val storage: Boolean = false,   // binds /storage/emulated/0 -> /sdcard
    val network: Boolean = true,
)

/** An installed machine. Persisted as JSON; no database, no code generation. */
@Serializable
data class Machine(
    val id: String,                 // uuid
    val name: String,               // user-chosen, shown on the home screen
    val distroId: String,
    val desktopId: String,
    val profile: ResourceProfile,
    val permissions: MachinePermissions,
    val displayWidth: Int,
    val displayHeight: Int,
    val createdAtEpochMs: Long,
    val state: MachineState,
)

@Serializable
enum class MachineState { INSTALLING, READY, FAILED, NEEDS_REPAIR }
```

### Compatibility verdict

```kotlin
enum class Compatibility { GOOD, TIGHT, BLOCKED }

data class CompatSignal(
    val label: String,              // "RAM", "Storage", "CPU"
    val detail: String,             // "6.0 GB"
    val verdict: Compatibility,
)

data class CompatReport(
    val overall: Compatibility,
    val signals: List<CompatSignal>,
    /** Null until the live proot probe has run; see DeviceProbe.runProotProbe(). */
    val prootWorks: Boolean?,
)
```

---

## `io.nawah.linux.core.probe.DeviceProbe`

```kotlin
interface DeviceProbe {
    fun abi(): String
    fun totalRamBytes(): Long
    fun availableStorageBytes(): Long
    fun cpuCores(): Int
    fun apiLevel(): Int

    /** Static signals only. Cheap, safe to call while rendering a list. */
    fun report(distro: DistroSpec, desktop: DesktopSpec?): CompatReport

    /**
     * Executes the bundled proot against a tiny busybox rootfs and runs `true`.
     * Turns the compatibility badge from a guess into a fact, and catches OEMs
     * that disable ptrace before the user spends twenty minutes installing.
     * Result is cached for the process lifetime.
     */
    suspend fun runProotProbe(): Boolean
}
```

---

## `io.nawah.linux.core.runtime`

```kotlin
/** Absolute paths of the executables we ship inside nativeLibraryDir. */
interface NativeTools {
    val prootBinary: File          // .../libproot.so
    val prootLoader: File          // .../libproot-loader.so
    val busybox: File              // .../libbusybox.so
    val nativeLibDir: File
    fun isComplete(): Boolean
}

/** Builds the proot argv. Pure function of its inputs -- unit-tested with golden files. */
object ProotArgsBuilder {
    fun build(request: ProotRequest): List<String>
}

data class ProotRequest(
    val tools: NativeTools,
    val rootfs: File,
    val containerDir: File,        // holds shm/, tmp/, fake /proc stubs
    val cwd: String = "/root",
    val uid: Int = 0,
    val gid: Int = 0,
    val hostname: String = "nawah",
    val bindStorage: Boolean = false,
    val extraBinds: List<Bind> = emptyList(),
    val env: Map<String, String> = emptyMap(),
    val command: List<String>,
)

data class Bind(val source: String, val target: String? = null)

/** Runs a proot command and streams its combined output line by line. */
interface ProotRunner {
    fun stream(request: ProotRequest): Flow<String>
    suspend fun run(request: ProotRequest): ProotResult
}

data class ProotResult(val exitCode: Int, val output: String)
```

---

## `io.nawah.linux.core.provision`

```kotlin
sealed interface InstallStep {
    val order: Int
    val label: String
}
// Downloading, Verifying, Extracting, Bootstrapping, InstallingPackages,
// InstallingX11Bridge, Configuring

sealed interface InstallProgress {
    data class Running(val step: InstallStep, val fraction: Float?, val line: String?) : InstallProgress
    data class Done(val machine: Machine) : InstallProgress
    data class Failed(val step: InstallStep, val message: String, val log: String) : InstallProgress
}

/** Everything the pipeline needs, decided before the first byte is downloaded. */
data class InstallRequest(
    val machineId: String,          // uuid, generated by the caller
    val name: String,               // user-chosen machine name
    val distro: DistroSpec,
    val desktop: DesktopSpec,
    val profile: ResourceProfile,
    val permissions: MachinePermissions,
    val displayWidth: Int,
    val displayHeight: Int,
    /** Resolved by the app from ConnectivityManager; written to /etc/resolv.conf. */
    val dnsServers: List<String> = listOf("1.1.1.1", "8.8.8.8"),
)

interface Provisioner {
    fun install(request: InstallRequest): Flow<InstallProgress>
    suspend fun remove(machineId: String)
    suspend fun repairX11Bridge(machineId: String)
}
```

---

## `io.nawah.linux.core.store.MachineStore`

```kotlin
interface MachineStore {
    val machines: StateFlow<List<Machine>>
    suspend fun put(machine: Machine)
    suspend fun delete(id: String)
    fun rootfsDir(id: String): File
    fun containerDir(id: String): File
}
```

---

## Directory layout on the device

```
<filesDir>/
  machines/
    <machine-id>/
      rootfs/          the Linux filesystem
      container/
        shm/           bound to /dev/shm
        tmp/           PROOT_TMP_DIR
        sysdata/       fake /proc stubs Android does not expose
      machine.json     metadata
      install.log
  probe-rootfs/        ~2 MB busybox tree used by the live proot probe
```
