package io.nawah.linux.core.probe

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.StatFs
import io.nawah.linux.core.model.CompatReport
import io.nawah.linux.core.model.CompatSignal
import io.nawah.linux.core.model.Compatibility
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroSpec
import io.nawah.linux.core.runtime.NativeTools
import io.nawah.linux.core.runtime.ProotRequest
import io.nawah.linux.core.runtime.ProotRunner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** What the device is, measured rather than assumed. */
data class DeviceFacts(
    val abi: String,
    val totalRamBytes: Long,
    val availableStorageBytes: Long,
    val cpuCores: Int,
    val apiLevel: Int,
)

interface DeviceProbe {
    fun facts(): DeviceFacts
    fun report(distro: DistroSpec, desktop: DesktopSpec?): CompatReport

    /**
     * Runs the bundled proot for real and checks it comes back.
     *
     * This is the only signal that is not a guess. Some OEM kernels refuse
     * `ptrace` for ordinary apps, and no amount of RAM or storage makes up for
     * that — better to find out in two seconds than after a twenty-minute
     * install. Cached once it has succeeded.
     */
    suspend fun runProotProbe(): ProbeResult
}

sealed interface ProbeResult {
    data object Passed : ProbeResult
    data class Failed(val reason: String) : ProbeResult
}

/**
 * Thresholds, as a pure function so they can be tested without a device.
 *
 * The numbers are deliberately conservative: TIGHT means "this will work and
 * be slow", BLOCKED means "do not let the user start". Getting BLOCKED wrong
 * in the permissive direction costs someone twenty minutes and a full disk.
 */
object CompatRules {

    fun evaluate(
        facts: DeviceFacts,
        requiredBytes: Long,
        prootWorks: Boolean?,
    ): CompatReport {
        val signals = buildList {
            add(abiSignal(facts.abi))
            add(ramSignal(facts.totalRamBytes))
            add(storageSignal(facts.availableStorageBytes, requiredBytes))
            add(androidSignal(facts.apiLevel))
            add(cpuSignal(facts.cpuCores))
        }
        // GOOD < TIGHT < BLOCKED by declaration order, so the worst verdict is
        // the *highest* ordinal. Taking the lowest would report a device with
        // 1 GB of RAM as fine, which is how this was wrong the first time.
        val worst = Compatibility.entries[signals.maxOf { it.verdict.ordinal }]
        val overall = when (prootWorks) {
            // A failed live probe outranks everything: nothing else matters if
            // the container cannot start at all.
            false -> Compatibility.BLOCKED
            else -> worst
        }
        return CompatReport(overall, signals, prootWorks)
    }

    private fun abiSignal(abi: String) = when {
        abi.startsWith("arm64") -> CompatSignal("CPU type", abi, Compatibility.GOOD)
        abi.startsWith("x86_64") -> CompatSignal("CPU type", abi, Compatibility.GOOD)
        abi.startsWith("armeabi") ->
            CompatSignal("CPU type", "$abi — 32-bit, no image is built for it", Compatibility.BLOCKED)
        else -> CompatSignal("CPU type", "$abi — unsupported", Compatibility.BLOCKED)
    }

    private fun ramSignal(bytes: Long): CompatSignal {
        val gb = bytes.toGb()
        return when {
            bytes < 2L * GB -> CompatSignal("Memory", "$gb GB — a desktop will not fit", Compatibility.BLOCKED)
            bytes < 3L * GB -> CompatSignal("Memory", "$gb GB — expect swapping", Compatibility.TIGHT)
            else -> CompatSignal("Memory", "$gb GB", Compatibility.GOOD)
        }
    }

    private fun storageSignal(available: Long, required: Long): CompatSignal {
        val a = available.toGb()
        val r = required.toGb()
        return when {
            available < required ->
                CompatSignal("Storage", "$a GB free, needs $r GB", Compatibility.BLOCKED)
            available < required * 3 / 2 ->
                CompatSignal("Storage", "$a GB free, needs $r GB — little room to update", Compatibility.TIGHT)
            else -> CompatSignal("Storage", "$a GB free", Compatibility.GOOD)
        }
    }

    private fun androidSignal(api: Int) = when {
        api < 24 -> CompatSignal("Android", "API $api — needs Android 7 or newer", Compatibility.BLOCKED)
        else -> CompatSignal("Android", "API $api", Compatibility.GOOD)
    }

    private fun cpuSignal(cores: Int) = when {
        cores < 4 -> CompatSignal("Cores", "$cores — installing will be slow", Compatibility.TIGHT)
        else -> CompatSignal("Cores", "$cores", Compatibility.GOOD)
    }

    private const val GB = 1024L * 1024 * 1024
    private fun Long.toGb(): String = String.format("%.1f", this.toDouble() / GB)
}

class AndroidDeviceProbe(
    private val context: Context,
    private val tools: NativeTools,
    private val runner: ProotRunner,
) : DeviceProbe {

    @Volatile private var cached: ProbeResult? = null

    override fun facts(): DeviceFacts {
        val am = context.getSystemService(ActivityManager::class.java)
        val mem = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val stat = StatFs(context.filesDir.absolutePath)
        return DeviceFacts(
            abi = Build.SUPPORTED_ABIS.firstOrNull().orEmpty(),
            totalRamBytes = mem.totalMem,
            availableStorageBytes = stat.availableBytes,
            cpuCores = Runtime.getRuntime().availableProcessors(),
            apiLevel = Build.VERSION.SDK_INT,
        )
    }

    override fun report(distro: DistroSpec, desktop: DesktopSpec?): CompatReport {
        val required = distro.installedBytes + (desktop?.installedBytes ?: 0L) + HEADROOM
        val works = when (cached) {
            ProbeResult.Passed -> true
            is ProbeResult.Failed -> false
            null -> null
        }
        return CompatRules.evaluate(facts(), required, works)
    }

    override suspend fun runProotProbe(): ProbeResult = withContext(Dispatchers.IO) {
        cached?.let { if (it is ProbeResult.Passed) return@withContext it }
        val missing = tools.missingTools()
        if (missing.isNotEmpty()) {
            return@withContext ProbeResult.Failed("bundled tools missing: ${missing.joinToString()}")
                .also { cached = it }
        }
        val result = runCatching {
            val root = prepareProbeRootfs()
            val out = runner.run(
                ProotRequest(
                    tools = tools,
                    rootfs = root,
                    containerDir = File(context.filesDir, "probe-container"),
                    cwd = "/",
                    hostname = "probe",
                    command = listOf(tools.busybox.absolutePath, "true"),
                ),
            )
            if (out.isSuccess) ProbeResult.Passed
            else ProbeResult.Failed(out.output.trim().takeLast(400).ifEmpty { "exit ${out.exitCode}" })
        }.getOrElse { ProbeResult.Failed(it.message ?: it::class.java.simpleName) }
        cached = result
        result
    }

    /**
     * The smallest rootfs that proves anything: an empty tree. busybox comes
     * from `nativeLibraryDir`, which proot can still reach because it binds
     * nothing away — so there is no filesystem to populate at all.
     */
    private fun prepareProbeRootfs(): File =
        File(context.filesDir, "probe-rootfs").apply {
            mkdirs()
            File(this, "tmp").mkdirs()
        }

    private companion object {
        /** apt needs working room well beyond the final installed size. */
        const val HEADROOM = 1_500L * 1024 * 1024
    }
}
