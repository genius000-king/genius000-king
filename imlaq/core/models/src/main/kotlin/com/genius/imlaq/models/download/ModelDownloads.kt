package com.genius.imlaq.models.download

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.models.catalog.Catalog
import com.genius.imlaq.models.catalog.CatalogEntry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.io.File

sealed interface DownloadState {
    data object Idle : DownloadState
    data class Running(val done: Long, val total: Long) : DownloadState {
        val fraction: Float get() = if (total > 0) (done.toDouble() / total).toFloat() else 0f
    }
    data class Failed(val message: String) : DownloadState
}

/**
 * One-tap downloads of catalog models, straight into the internal models directory (a real
 * filesystem, where the engine's O_DIRECT reads run at full speed). Each runs as WorkManager
 * work, so it survives the app closing and resumes after a network drop.
 */
class ModelDownloads(private val context: Context, private val modelsDir: File) {

    private val work get() = WorkManager.getInstance(context)

    fun start(entry: CatalogEntry) {
        val request = OneTimeWorkRequestBuilder<ModelDownloadWorker>()
            .setInputData(workDataOf(KEY_ID to entry.id, KEY_DIR to modelsDir.path))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .addTag(TAG)
            .build()
        work.enqueueUniqueWork(workName(entry), ExistingWorkPolicy.KEEP, request)
    }

    /** Stops the download and deletes what it fetched so far. */
    fun cancel(entry: CatalogEntry) {
        work.cancelUniqueWork(workName(entry))
        entry.files.forEach { File(modelsDir, it.name + PART).delete() }
    }

    fun state(entry: CatalogEntry): Flow<DownloadState> =
        work.getWorkInfosForUniqueWorkFlow(workName(entry)).map { infos ->
            val info = infos.lastOrNull() ?: return@map DownloadState.Idle
            when (info.state) {
                WorkInfo.State.ENQUEUED, WorkInfo.State.RUNNING, WorkInfo.State.BLOCKED -> {
                    val p = info.progress
                    DownloadState.Running(p.getLong(KEY_DONE, partialBytes(entry).value), p.getLong(KEY_TOTAL, entry.totalBytes))
                }
                WorkInfo.State.FAILED -> DownloadState.Failed(info.outputData.getString(KEY_ERROR) ?: "تعذّر التنزيل")
                else -> DownloadState.Idle
            }
        }

    /** Bytes already on disk for [entry], finished files and `.part` files together. */
    fun partialBytes(entry: CatalogEntry): Bytes = Bytes(
        entry.files.sumOf { f ->
            val done = File(modelsDir, f.name)
            if (done.isFile) done.length() else File(modelsDir, f.name + PART).let { if (it.isFile) it.length() else 0L }
        },
    )

    companion object {
        internal const val TAG = "model-download"
        internal const val KEY_ID = "id"
        internal const val KEY_DIR = "dir"
        internal const val KEY_DONE = "done"
        internal const val KEY_TOTAL = "total"
        internal const val KEY_ERROR = "error"
        internal const val PART = ".part"
        internal fun workName(entry: CatalogEntry) = "download-${entry.id}"
    }
}

/**
 * Fetches every file of one catalog entry in order. Bytes go to `<name>.part`, renamed to
 * `<name>` only when complete, so a half-downloaded model is never offered to the engine.
 */
class ModelDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val entry = Catalog.byId(inputData.getString(ModelDownloads.KEY_ID).orEmpty())
            ?: return@withContext Result.failure(error("نموذج غير معروف"))
        val dir = File(inputData.getString(ModelDownloads.KEY_DIR) ?: return@withContext Result.failure(error("no dir")))
        dir.mkdirs()

        val total = entry.totalBytes
        val onDisk = entry.files.sumOf { f ->
            File(dir, f.name).takeIf { it.isFile }?.length() ?: File(dir, f.name + ModelDownloads.PART).takeIf { it.isFile }?.length() ?: 0L
        }
        if (total - onDisk > dir.usableSpace) {
            return@withContext Result.failure(error("المساحة ما تكفي"))
        }

        setForeground(foreground(entry, 0))
        val downloader = RangeDownloader()
        var before = 0L
        try {
            for (file in entry.files) {
                val done = File(dir, file.name)
                if (done.isFile && done.length() == file.bytes) {
                    before += file.bytes
                    continue
                }
                val part = File(dir, file.name + ModelDownloads.PART)
                var lastPct = -1
                downloader.download(file.url, part, file.bytes, onProgress = { got, _ ->
                    val all = before + got
                    setProgressAsync(workDataOf(ModelDownloads.KEY_DONE to all, ModelDownloads.KEY_TOTAL to total))
                    val pct = (all * 100 / total).toInt()
                    if (pct != lastPct) {
                        lastPct = pct
                        setForegroundAsync(foreground(entry, pct))
                    }
                }, isCancelled = { isStopped })
                if (!part.renameTo(done)) return@withContext Result.failure(error("ما قدرت أحفظ الملف"))
                before += file.bytes
            }
            Result.success()
        } catch (e: DownloadException) {
            when {
                isStopped -> Result.failure()
                e.retryable && runAttemptCount < MAX_ATTEMPTS -> Result.retry()
                else -> Result.failure(error(e.message ?: "تعذّر التنزيل"))
            }
        }
    }

    private fun error(message: String) = workDataOf(ModelDownloads.KEY_ERROR to message)

    private fun foreground(entry: CatalogEntry, pct: Int): ForegroundInfo {
        val nm = applicationContext.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "التنزيلات", NotificationManager.IMPORTANCE_LOW))
        }
        val n = NotificationCompat.Builder(applicationContext, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(entry.name)
            .setContentText("ينزل… $pct٪")
            .setProgress(100, pct, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
        val id = NOTIFICATION_BASE + entry.id.hashCode().and(0xFFF)
        return if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(id, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else ForegroundInfo(id, n)
    }

    private companion object {
        const val CHANNEL = "downloads"
        const val NOTIFICATION_BASE = 1000
        const val MAX_ATTEMPTS = 8
    }
}
