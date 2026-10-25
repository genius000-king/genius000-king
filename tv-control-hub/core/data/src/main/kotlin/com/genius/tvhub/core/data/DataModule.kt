package com.genius.tvhub.core.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStoreFile
import androidx.room.Room
import com.genius.tvhub.core.common.Clock
import com.genius.tvhub.core.common.DispatcherProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DataModule {
    @Provides @Singleton
    fun database(@ApplicationContext context: Context): HubDatabase =
        Room.databaseBuilder(context, HubDatabase::class.java, "hub.db").build()

    @Provides fun trustedDao(db: HubDatabase) = db.trustedDevices()
    @Provides fun pairedDao(db: HubDatabase) = db.pairedTvs()
    @Provides fun serviceDao(db: HubDatabase) = db.services()

    @Provides @Singleton
    fun dataStore(@ApplicationContext context: Context): DataStore<Preferences> =
        PreferenceDataStoreFactory.create { context.preferencesDataStoreFile("settings") }

    @Provides fun clock(): Clock = Clock.System
    @Provides fun dispatchers(): DispatcherProvider = DispatcherProvider.Standard
}
