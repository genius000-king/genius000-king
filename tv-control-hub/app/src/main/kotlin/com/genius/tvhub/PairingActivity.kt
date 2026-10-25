package com.genius.tvhub

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.activity.viewModels
import com.genius.tvhub.core.designsystem.Effects
import com.genius.tvhub.core.designsystem.ImlaqTheme
import com.genius.tvhub.feature.tv.system.PairingPrompt
import com.genius.tvhub.feature.tv.system.PairingViewModel
import dagger.hilt.android.AndroidEntryPoint

/** Floats over whatever the TV shows while a phone asks to pair; closes itself once answered. */
@AndroidEntryPoint
class PairingActivity : ComponentActivity() {
    private val vm: PairingViewModel by viewModels()

    override fun attachBaseContext(newBase: Context) = super.attachBaseContext(LocaleStore.wrap(newBase))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val request by vm.request.collectAsStateWithLifecycle()
            ImlaqTheme(dark = true, effects = Effects.LITE) {
                val r = request
                if (r == null) LaunchedEffect(Unit) { finish() }
                else PairingPrompt(r.peer.name, r.code, onAllow = { vm.allow(); finish() }, onDeny = { vm.deny(); finish() })
            }
        }
    }
}
