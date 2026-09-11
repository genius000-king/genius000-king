package io.nawah.linux.core.provision

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/**
 * How far an install got, written to disk after every step.
 *
 * An install is ten to twenty-five minutes of downloading and unpacking, and
 * the things that interrupt it — a dropped connection, the system reclaiming
 * the process, the user leaving — are ordinary, not exceptional. Starting over
 * from zero each time is the wrong answer to an ordinary event.
 *
 * The request is stored alongside the progress because a resume happens in a
 * different process than the one that started it: there is nothing left in
 * memory to resume *from*.
 */
@Serializable
data class InstallCheckpoint(
    val request: InstallRequest,
    val completed: List<InstallStep> = emptyList(),
) {
    fun isDone(step: InstallStep): Boolean = step in completed

    fun withCompleted(step: InstallStep): InstallCheckpoint =
        if (isDone(step)) this else copy(completed = completed + step)

    /** The first step that still has work to do. */
    val nextStep: InstallStep?
        get() = InstallStep.ordered.firstOrNull { !isDone(it) }

    companion object {
        private const val FILE = "install-state.json"
        private val json = Json { ignoreUnknownKeys = true; prettyPrint = true }

        fun file(machineDir: File): File = File(machineDir, FILE)

        fun load(machineDir: File): InstallCheckpoint? =
            file(machineDir).takeIf { it.isFile }?.let {
                runCatching { json.decodeFromString<InstallCheckpoint>(it.readText()) }.getOrNull()
            }

        /** Written through a temporary file: a kill mid-write must not lose the record. */
        fun save(machineDir: File, checkpoint: InstallCheckpoint) {
            machineDir.mkdirs()
            val target = file(machineDir)
            val tmp = File(machineDir, "$FILE.tmp")
            tmp.writeText(json.encodeToString(checkpoint))
            if (!tmp.renameTo(target)) {
                target.delete()
                tmp.renameTo(target)
            }
        }

        fun clear(machineDir: File) {
            file(machineDir).delete()
        }
    }
}
