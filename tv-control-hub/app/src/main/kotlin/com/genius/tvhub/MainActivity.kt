package com.genius.tvhub

import android.content.Context
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.designsystem.ImlaqTheme
import com.genius.tvhub.core.designsystem.OverlayHost
import com.genius.tvhub.core.model.DeviceRole
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.protocol.Call
import com.genius.tvhub.runtime.client.HubClient
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The only activity: the TV home on a TV, the remote on a phone. Always charcoal. */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var settings: SettingsStore
    @Inject lateinit var hub: HubClient

    private val role get() = (application as TvHubApp).role

    override fun attachBaseContext(newBase: Context) = super.attachBaseContext(LocaleStore.wrap(newBase))

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // A language change needs a fresh activity: its resources were loaded with the old locale.
        lifecycleScope.launch { settings.settings.drop(1).collect { if (LocaleStore.save(this@MainActivity, it.language)) recreate() } }
        setContent {
            val s by settings.settings.collectAsStateWithLifecycle(HubSettings())
            ImlaqTheme(dark = true, effects = RoleDetector.effects(this, s.effects)) {
                OverlayHost {
                    when (role) {
                        DeviceRole.TV -> TvRoot()
                        DeviceRole.PHONE -> PhoneRoot()
                    }
                }
            }
        }
    }

    /** On the phone, the hardware volume buttons turn the TV up and down while connected. */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (!volumeForTv(keyCode)) return super.onKeyDown(keyCode, event)
        lifecycleScope.launch {
            if (settings.current().volumeKeysControlTv) {
                runCatching { hub.call(Call.Key(if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) KeyAction.VOLUME_UP else KeyAction.VOLUME_DOWN)) }
            }
        }
        return true
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean = volumeForTv(keyCode) || super.onKeyUp(keyCode, event)

    private fun volumeForTv(keyCode: Int) = role == DeviceRole.PHONE && hub.state.value is LinkState.Connected &&
        (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)
}
