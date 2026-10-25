package com.genius.tvhub.runtime.host

import android.content.Context
import com.genius.tvhub.core.data.ServiceStore
import com.genius.tvhub.engine.apps.AndroidAppsEngine
import com.genius.tvhub.engine.files.FilesEngine
import com.genius.tvhub.engine.input.AccessibilityInputEngine
import com.genius.tvhub.engine.monitor.MonitorEngine
import com.genius.tvhub.engine.shell.sandbox.SandboxShell
import com.genius.tvhub.engine.shell.services.ServiceManager
import com.genius.tvhub.engine.shell.termux.TermuxBridge
import com.genius.tvhub.engine.stream.StreamEngine
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Builds each engine once and the ports the router sees. Engines never construct each other. */
@Module
@InstallIn(SingletonComponent::class)
object HostModule {
    @Provides @Singleton fun input(@ApplicationContext c: Context) = AccessibilityInputEngine(c)
    @Provides @Singleton fun apps(@ApplicationContext c: Context) = AndroidAppsEngine(c)
    @Provides @Singleton fun stream(@ApplicationContext c: Context) = StreamEngine(c)
    @Provides @Singleton fun monitor(@ApplicationContext c: Context) = MonitorEngine(c)
    @Provides @Singleton fun files(@ApplicationContext c: Context) = FilesEngine(c)
    @Provides @Singleton fun termux(@ApplicationContext c: Context) = TermuxBridge(c)

    @Provides @Singleton
    fun ports(
        @ApplicationContext c: Context,
        input: AccessibilityInputEngine, apps: AndroidAppsEngine, stream: StreamEngine,
        monitor: MonitorEngine, files: FilesEngine, termux: TermuxBridge, services: ServiceStore,
    ) = HostPorts(
        input = input,
        apps = apps,
        monitor = MonitorAdapter(monitor),
        files = FilesAdapter(files),
        shell = ShellAdapter(SandboxShell(c.filesDir), termux),
        services = ServicesAdapter(services, ServiceManager(termux), termux),
        stream = StreamAdapter(stream),
    )
}
