package com.genius.tvhub.runtime.client

import android.content.Context
import android.os.Build
import android.provider.Settings
import com.genius.tvhub.core.data.IdentityStore
import com.genius.tvhub.core.data.PairedTvStore
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.discovery.NsdBrowser
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ClientModule {
    @Provides @Singleton
    fun hub(@ApplicationContext c: Context, identity: IdentityStore, paired: PairedTvStore, settings: SettingsStore): HubClient {
        val name = Settings.Global.getString(c.contentResolver, Settings.Global.DEVICE_NAME) ?: Build.MODEL
        val browser = NsdBrowser(c)
        return HubClient(
            self = HubClient.selfPeer(identity.key, name, "${Build.MANUFACTURER} ${Build.MODEL}", "0.1.0"),
            identity = { identity.key },
            discovery = { browser.browse() },
            paired = paired,
            settings = settings,
        )
    }

    @Provides fun input(h: HubClient) = RemoteInput(h)
    @Provides fun device(h: HubClient) = RemoteDevice(h)
    @Provides fun files(h: HubClient) = RemoteFiles(h)
    @Provides fun apps(h: HubClient) = RemoteApps(h)
    @Provides fun shell(h: HubClient) = RemoteShell(h)
    @Provides fun services(h: HubClient) = RemoteServices(h)
}
