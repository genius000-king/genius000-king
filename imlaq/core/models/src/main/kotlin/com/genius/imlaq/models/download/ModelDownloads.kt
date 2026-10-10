package com.genius.imlaq.models.download

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.net.Uri
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile

sealed interface DownloadState {
    data object Idle : DownloadState
    data class Running(val done: Long, val total: Long) : DownloadState {
        val fraction: Float get() = if (total > 0) (done.toDouble() / total).toFloat() else 0f
    }
    data class Failed(val message: String) : DownloadState
}

/** A transfer in flight (or one that failed and is waiting for a retry or a cancel). */
data class ActiveTransfer(val spec: DownloadSpec, val state: DownloadState)

/**
 * Brings models into the internal models directory (a real filesystem, where the engine's
 * O_DIRECT reads run at full speed): downloads from any https URL, and copies of files the user
 * picked on the phone. Each runs as WorkManager work, so it survives the app closing and resumes
 * after a dropped connection.
 */
class ModelDownloads(private val context: Context, private val modelsDir: File) {

    private val work get() = WorkManager.getInstance(context)

    fun start(spec: DownloadSpec) {
        val fromNetwork = spec.files.any { it.source.startsWith("http") }
        val request = OneTimeWorkRequestBuilder<ModelDownloadWorker>()
            .setInputData(workDataOf(KEY_SPEC to spec.encode(), KEY_DIR to modelsDir.path))
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(if (fromNetwork) NetworkType.CONNECTED else NetworkType.NOT_REQUIRED)
                    .build(),
            )
            .addTag(TAG)
            .addTag(SPEC_TAG + spec.encode())
            .build()
        work.enqueueUniqueWork(workName(spec.id), ExistingWorkPolicy.KEEP, request)
    }

    /** Stops the transfer and deletes what it fetched so far. */
    fun cancel(spec: DownloadSpec) {
        work.cancelUniqueWork(workName(spec.id))
        spec.files.forEach { File(modelsDir, it.name + PART).delete() }
    }

    /** Every transfer that is running, queued, or failed and not yet dismissed. */
    fun active(): Flow<List<ActiveTransfer>> = work.getWorkInfosByTagFlow(TAG).map { infos ->
        infos
            .filter { it.state != WorkInfo.State.SUCCEEDED && it.state != WorkInfo.State.CANCELLED }
            .mapNotNull { info ->
                val spec = info.tags.firstOrNull { it.startsWith(SPEC_TAG) }?.removePrefix(SPEC_TAG)
                    ?.let { runCatching { DownloadSpec.decode(it) }.getOrNull() } ?: return@mapNotNull null
                ActiveTransfer(spec, stateOf(info, spec))
            }
            .distinctBy { it.spec.id }
    }

    /** Bytes already on disk for [spec], finished files and `.part` files together. */
    fun partialBytes(spec: DownloadSpec): Bytes = Bytes(
        spec.files.sumOf { f ->
            val done = File(modelsDir, f.name)
            if (done.isFile) done.length() else File(modelsDir, f.name + PART).let { if (it.isFile) it.length() else 0L }
        },
    )

    private fun stateOf(info: WorkInfo, spec: DownloadSpec): DownloadState = when (info.state) {
        WorkInfo.State.FAILED -> DownloadState.Failed(info.outputData.getString(KEY_ERROR) ?: "تعذّر التنزيل")
        else -> DownloadState.Running(
            info.progress.getLong(KEY_DONE, partialBytes(spec).value),
            info.progress.getLong(KEY_TOTAL, spec.totalBytes),
        )
    }

    companion object {
        internal const val TAG = "model-transfer"
        internal const val SPEC_TAG = "spec="
        internal const val KEY_SPEC = "spec"
        internal const val KEY_DIR = "dir"
        internal const val KEY_DONE = "done"
        internal const val KEY_TOTAL = "total"
        internal const val KEY_ERROR = "error"
        const val PART = ".part"
        internal fun workName(id: String) = "transfer-$id"
    }
}

/**
 * Fetches every file of one spec in order. Bytes go to `<name>.part`, renamed to `<name>` only
 * when complete, so a half-transferred model is never offered to the engine.
 */
class ModelDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val spec = inputData.getString(ModelDownloads.KEY_SPEC)?.let { runCatching { DownloadSpec.decode(it) }.getOrNull() }
            ?: return@withContext Result.failure(error("طلب تنزيل تالف"))
        val dir = File(inputData.getString(ModelDownloads.KEY_DIR) ?: return@withContext Result.failure(error("no dir")))
        dir.mkdirs()

        val total = spec.totalBytes
        val onDisk = spec.files.sumOf { f ->
            File(dir, f.name).takeIf { it.isFile }?.length() ?: File(dir, f.name + ModelDownloads.PART).takeIf { it.isFile }?.length() ?: 0L
        }
        if (total - onDisk > dir.usableSpace) return@withContext Result.failure(error("المساحة ما تكفي"))

        setForeground(foreground(spec, 0))
        val downloader = RangeDownloader()
        var before = 0L
        var lastPct = -1
        val report: (Long) -> Unit = { got ->
            val all = before + got
            setProgressAsync(workDataOf(ModelDownloads.KEY_DONE to all, ModelDownloads.KEY_TOTAL to total))
            val pct = if (total > 0) (all * 100 / total).toInt() else 0
            if (pct != lastPct) {
                lastPct = pct
                setForegroundAsync(foreground(spec, pct))
            }
        }
        try {
            for (file in spec.files) {
                val done = File(dir, file.name)
                if (done.isFile && (file.bytes <= 0 || done.length() == file.bytes)) {
                    before += done.length()
                    continue
                }
                val part = File(dir, file.name + ModelDownloads.PART)
                if (file.source.startsWith("content://")) {
                    copyFromPhone(Uri.parse(file.source), part, report)
                } else {
                    downloader.download(file.source, part, file.bytes, onProgress = { got, _ -> report(got) }, isCancelled = { isStopped })
                }
                if (!part.renameTo(done)) return@withContext Result.failure(error("ما قدرت أحفظ الملف"))
                before += done.length()
            }
            Result.success()
        } catch (e: DownloadException) {
            when {
                isStopped -> Result.failure()
                e.retryable && runAttemptCount < MAX_ATTEMPTS -> Result.retry()
                else -> Result.failure(error(e.message ?: "تعذّر التنزيل"))
            }
        } catch (e: SecurityException) {
            Result.failure(error("انتهى إذن الوصول للملف، اختره مرة ثانية"))
        }
    }

    /** Copies a picked file, continuing from a previous partial copy. */
    private fun copyFromPhone(uri: Uri, part: File, report: (Long) -> Unit) {
        val input = applicationContext.contentResolver.openInputStream(uri)
            ?: throw DownloadException("ما قدرت أفتح الملف", retryable = false)
        input.use { inp ->
            RandomAccessFile(part, "rw").use { out ->
                var done = out.length()
                var skip = done
                while (skip > 0) {
                    val s = inp.skip(skip)
                    if (s <= 0) break
                    skip -= s
                }
                if (skip > 0) { done = 0; out.setLength(0) }
                out.seek(done)
                val buf = ByteArray(1 shl 20)
                var lastReport = done
                while (true) {
                    if (isStopped) throw DownloadException("cancelled", retryable = false)
                    val n = inp.read(buf)
                    if (n < 0) break
                    out.write(buf, 0, n)
                    done += n
                    if (done - lastReport >= 32L shl 20) { report(done); lastReport = done }
                }
                report(done)
            }
        }
    }

    private fun error(message: String) = workDataOf(ModelDownloads.KEY_ERROR to message)

    private fun foreground(spec: DownloadSpec, pct: Int): ForegroundInfo {
        val nm = applicationContext.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "التنزيلات", NotificationManager.IMPORTANCE_LOW))
        }
        val n = NotificationCompat.Builder(applicationContext, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(spec.title)
            .setContentText("$pct٪")
            .setProgress(100, pct, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
        val id = NOTIFICATION_BASE + spec.id.hashCode().and(0xFFF)
        return if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(id, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else ForegroundInfo(id, n)
    }

    private companion object {
        const val CHANNEL = "downloads"
        const val NOTIFICATION_BASE = 1000
        const val MAX_ATTEMPTS = 8
    }
}
