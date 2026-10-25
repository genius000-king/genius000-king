package com.genius.tvhub.core.data

import android.content.Context
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.genius.tvhub.core.common.Clock
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.ServiceKind
import com.genius.tvhub.core.model.ServiceSpec
import com.genius.tvhub.core.model.ThemeMode
import com.genius.tvhub.core.security.fingerprintOf
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class StoresTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private lateinit var db: HubDatabase
    private var now = 1_000L
    private val clock = object : Clock {
        override fun nowMillis() = now
        override fun monotonicMillis() = now
    }

    @Before fun open() { db = Room.inMemoryDatabaseBuilder(context, HubDatabase::class.java).allowMainThreadQueries().build() }
    @After fun close() = db.close()

    @Test fun trustLifecycle() = runTest {
        val store = TrustStore(db.trustedDevices(), clock)
        store.trust("p1", "Phone", "S24", byteArrayOf(1, 2), Grants.DEFAULT)
        assertThat(store.get("p1")!!.grants).isEqualTo(Grants.DEFAULT)
        store.setGrants("p1", Grants.DEFAULT + Grant.SHELL)
        assertThat(Grant.SHELL in store.get("p1")!!.grants).isTrue()
        now = 5_000; store.seen("p1")
        assertThat(store.devices.first().single().lastSeenAt).isEqualTo(5_000)
        store.revoke("p1")
        assertThat(store.get("p1")).isNull()
    }

    @Test fun pairedTvKeepsFirstPairingTime() = runTest {
        val store = PairedTvStore(db.pairedTvs(), clock)
        store.remember("tv", "Box", byteArrayOf(9), "10.0.0.5", 47800)
        now = 9_000
        store.remember("tv", "Box", byteArrayOf(9), "10.0.0.6", 47800)
        val tv = store.get("tv")!!
        assertThat(tv.pairedAt).isEqualTo(1_000)
        assertThat(tv.lastConnectedAt).isEqualTo(9_000)
        assertThat(tv.host).isEqualTo("10.0.0.6")
    }

    @Test fun servicesRoundTrip() = runTest {
        val store = ServiceStore(db.services())
        store.save(ServiceSpec("web", "Web", ServiceKind.NODE, "~/web", "node index.js", true))
        assertThat(store.all().single().kind).isEqualTo(ServiceKind.NODE)
        store.remove("web")
        assertThat(store.all()).isEmpty()
    }

    @Test fun settingsDefaultsAndUpdates() = runTest {
        val file = File(context.cacheDir, "s-${System.nanoTime()}.preferences_pb")
        val store = SettingsStore(PreferenceDataStoreFactory.create(scope = TestScope(testScheduler).backgroundScope) { file })
        assertThat(store.current()).isEqualTo(HubSettings())
        store.update { it.copy(theme = ThemeMode.LIGHT, language = AppLanguage.ARABIC, favorites = listOf("a", "b"), lastTvId = "tv") }
        val s = store.current()
        assertThat(s.theme).isEqualTo(ThemeMode.LIGHT)
        assertThat(s.language).isEqualTo(AppLanguage.ARABIC)
        assertThat(s.favorites).containsExactly("a", "b").inOrder()
        store.update { it.copy(lastTvId = null) }
        assertThat(store.current().lastTvId).isNull()
    }

    @Test fun identityPersistsAcrossInstances() {
        // Robolectric has no AndroidKeyStore: this exercises the software fallback and its persistence.
        val a = IdentityStore(context).key
        val b = IdentityStore(context).key
        assertThat(fingerprintOf(a.publicKey)).isEqualTo(fingerprintOf(b.publicKey))
        assertThat(a.sign("x".toByteArray())).isNotEmpty()
    }
}
