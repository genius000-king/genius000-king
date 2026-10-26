package com.genius.tvhub.engine.apps.install

import com.genius.tvhub.core.protocol.InstallState
import com.genius.tvhub.engine.apps.api.InstallUpdate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Installs with nobody at the TV: the APKs land in files, then a silent installer (ADB mode)
 * takes them. Same begin/write/commit shape as [SessionInstaller], so callers don't care which.
 */
class StagedInstaller(
    private val root: File,
    private val deviceAbis: List<String>,
    private val silent: suspend (List<File>) -> String?,
) {
    private class Pending(val dir: File, val ledger: InstallLedger)
    private val pending = ConcurrentHashMap<String, Pending>()

    fun begin(splitSizes: List<Long>): String {
        val id = UUID.randomUUID().toString()
        val dir = File(root, id).apply { mkdirs() }
        pending[id] = Pending(dir, InstallLedger(splitSizes))
        return id
    }

    fun write(id: String, split: Int, offset: Long, data: ByteArray) {
        val p = pending[id] ?: throw IllegalStateException("unknown install $id")
        p.ledger.accept(split, offset, data.size)
        RandomAccessFile(File(p.dir, p.ledger.splitName(split)), "rw").use { it.seek(offset); it.write(data) }
    }

    fun commit(id: String): Flow<InstallUpdate> = flow {
        val p = pending.remove(id) ?: run { emit(InstallUpdate(InstallState.FAILED, "unknown install")); return@flow }
        try {
            if (!p.ledger.complete) { emit(InstallUpdate(InstallState.FAILED, "transfer incomplete")); return@flow }
            val files = p.dir.listFiles().orEmpty().sortedBy { it.name }
            AbiCheck.mismatch(AbiCheck.abisOf(files), deviceAbis)?.let {
                emit(InstallUpdate(InstallState.FAILED, AbiCheck.needs(it, deviceAbis))); return@flow
            }
            emit(InstallUpdate(InstallState.INSTALLING))
            val error = silent(files)
            emit(if (error == null) InstallUpdate(InstallState.SUCCESS) else InstallUpdate(InstallState.FAILED, AbiCheck.explain(error, deviceAbis)))
        } finally {
            p.dir.deleteRecursively()
        }
    }

    fun abort(id: String) {
        pending.remove(id)?.dir?.deleteRecursively()
    }
}
