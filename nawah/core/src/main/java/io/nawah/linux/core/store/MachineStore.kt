package io.nawah.linux.core.store

import io.nawah.linux.core.model.Machine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.nio.file.Files

interface MachineStore {
    val machines: StateFlow<List<Machine>>
    suspend fun put(machine: Machine)
    suspend fun delete(id: String)
    fun get(id: String): Machine?
    fun machineDir(id: String): File
    fun rootfsDir(id: String): File
    fun containerDir(id: String): File
    fun logFile(id: String): File

    /** Output of the most recent run. Replaced each time the machine starts. */
    fun sessionLogFile(id: String): File
}

/**
 * Machines on disk, one directory each.
 *
 * No database: the list is a handful of records read once at startup, and a
 * code generator would buy nothing but build time. What it does buy is a
 * guarantee -- [put] writes to a temporary file and renames, so a process
 * killed mid-write leaves the previous record intact rather than a truncated
 * one. Installs get killed often; that is the whole reason.
 */
class FileMachineStore(private val rootDir: File) : MachineStore {

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = true }
    private val writeLock = Mutex()
    private val _machines = MutableStateFlow(loadAll())
    override val machines: StateFlow<List<Machine>> = _machines.asStateFlow()

    private val machinesRoot: File get() = File(rootDir, "machines")

    override fun machineDir(id: String): File = File(machinesRoot, id.sanitised())
    override fun rootfsDir(id: String): File = File(machineDir(id), "rootfs")
    override fun containerDir(id: String): File = File(machineDir(id), "container")
    override fun logFile(id: String): File = File(machineDir(id), "install.log")
    override fun sessionLogFile(id: String): File = File(machineDir(id), "session.log")
    override fun get(id: String): Machine? = _machines.value.firstOrNull { it.id == id }

    override suspend fun put(machine: Machine) = withContext(Dispatchers.IO) {
        writeLock.withLock {
            val dir = machineDir(machine.id).apply { mkdirs() }
            val target = File(dir, META)
            val tmp = File(dir, "$META.tmp")
            tmp.writeText(json.encodeToString(machine))
            if (!tmp.renameTo(target)) {
                target.delete()
                check(tmp.renameTo(target)) { "could not commit ${target.path}" }
            }
            _machines.value = loadAll()
        }
    }

    override suspend fun delete(id: String) = withContext(Dispatchers.IO) {
        writeLock.withLock {
            machineDir(id).deleteTree()
            _machines.value = loadAll()
        }
    }

    private fun loadAll(): List<Machine> =
        machinesRoot.listFiles()?.asSequence()
            ?.filter { it.isDirectory }
            ?.mapNotNull { dir ->
                runCatching { json.decodeFromString<Machine>(File(dir, META).readText()) }.getOrNull()
            }
            ?.sortedBy { it.createdAtEpochMs }
            ?.toList()
            ?: emptyList()

    private companion object {
        const val META = "machine.json"
    }
}

/** Ids come from UUIDs, but a path is not the place to find that out the hard way. */
private fun String.sanitised(): String =
    map { if (it.isLetterOrDigit() || it == '-' || it == '_') it else '_' }.joinToString("")

/**
 * Deletes without following symlinks.
 *
 * A rootfs is full of them -- and after `--link2symlink`, full of absolute ones
 * pointing back into itself. `File.deleteRecursively()` would happily walk one
 * out of the tree.
 */
private fun File.deleteTree() {
    if (!exists() && !Files.isSymbolicLink(toPath())) return
    if (isDirectory && !Files.isSymbolicLink(toPath())) {
        listFiles()?.forEach { it.deleteTree() }
    }
    delete()
}
