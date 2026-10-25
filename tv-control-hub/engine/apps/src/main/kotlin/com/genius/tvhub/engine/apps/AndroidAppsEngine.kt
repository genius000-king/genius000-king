package com.genius.tvhub.engine.apps

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.genius.tvhub.core.model.AppInfo
import com.genius.tvhub.engine.apps.api.AppsEngine
import com.genius.tvhub.engine.apps.api.IconResult
import com.genius.tvhub.engine.apps.api.InstallUpdate
import com.genius.tvhub.engine.apps.catalog.AppCatalog
import com.genius.tvhub.engine.apps.icons.IconLoader
import com.genius.tvhub.engine.apps.icons.LocalIcon
import com.genius.tvhub.engine.apps.install.SessionInstaller
import com.genius.tvhub.engine.apps.launch.AppLauncher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext

/** The apps engine on a real device: each part does one job, this class only routes. */
class AndroidAppsEngine(private val context: Context) : AppsEngine {
    val catalog = AppCatalog(context)
    val icons = IconLoader(context)
    val launcher = AppLauncher(context)
    private val installer = SessionInstaller(context)

    override val changes: Flow<Unit> = callbackFlow {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { trySend(Unit) }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED); addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_REPLACED); addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
        awaitClose { context.unregisterReceiver(receiver) }
    }

    override suspend fun list(): List<AppInfo> = withContext(Dispatchers.IO) {
        catalog.apps().map { app ->
            val info = catalog.appInfo(app.packageName)
            AppInfo(app.packageName, app.label, catalog.versionName(app.packageName), app.isTvApp, app.isSystem, catalog.installedAt(app.packageName), info?.let(catalog::sizeOf) ?: 0)
        }
    }

    suspend fun localIcon(packageName: String, sizePx: Int): LocalIcon? = withContext(Dispatchers.IO) { icons.load(packageName, sizePx) }

    override suspend fun icon(packageName: String, sizePx: Int): IconResult? = withContext(Dispatchers.IO) {
        icons.load(packageName, sizePx.coerceIn(32, 256))?.let { IconResult(icons.png(it), it.accent) }
    }

    override fun launch(packageName: String) = launcher.launch(packageName)
    override fun uninstall(packageName: String) = launcher.uninstall(packageName)
    override fun showInfo(packageName: String) = launcher.showInfo(packageName)

    override fun canInstall() = context.packageManager.canRequestPackageInstalls()

    override fun requestInstallPermission() {
        runCatching {
            context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    override suspend fun beginInstall(label: String, splitSizes: List<Long>) = withContext(Dispatchers.IO) { installer.begin(splitSizes) }
    override suspend fun writeInstall(id: String, split: Int, offset: Long, data: ByteArray) = withContext(Dispatchers.IO) { installer.write(id, split, offset, data) }
    override fun commitInstall(id: String): Flow<InstallUpdate> = installer.commit(id)
    override fun abortInstall(id: String) = installer.abort(id)
}
