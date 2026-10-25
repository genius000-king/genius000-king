package com.genius.tvhub.feature.phone.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.genius.tvhub.core.data.IdentityStore
import com.genius.tvhub.core.data.PairedTvStore
import com.genius.tvhub.core.data.SettingsStore
import com.genius.tvhub.core.designsystem.GhostButton
import com.genius.tvhub.core.designsystem.GlassCard
import com.genius.tvhub.core.designsystem.GlassField
import com.genius.tvhub.core.designsystem.HubPage
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.KeyValueRow
import com.genius.tvhub.core.designsystem.PillButton
import com.genius.tvhub.core.designsystem.SectionLabel
import com.genius.tvhub.core.designsystem.SegmentedTabs
import com.genius.tvhub.core.designsystem.ToggleRow
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.PairedTv
import com.genius.tvhub.core.security.fingerprintOf
import com.genius.tvhub.core.security.shortFingerprint
import com.genius.tvhub.runtime.client.HubClient
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settings: SettingsStore,
    private val paired: PairedTvStore,
    private val hub: HubClient,
    identity: IdentityStore,
) : ViewModel() {
    val state: StateFlow<HubSettings> = settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, HubSettings())
    val tvs: StateFlow<List<PairedTv>> = paired.tvs.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val fingerprint: String = shortFingerprint(fingerprintOf(identity.key.publicKey))

    fun update(change: (HubSettings) -> HubSettings) { viewModelScope.launch { settings.update(change) } }
    fun forget(tv: PairedTv) { viewModelScope.launch { hub.forget(tv.id) } }

    /** "host" or "host:port"; the default port when omitted. */
    fun connect(address: String) {
        val host = address.substringBeforeLast(':', address).trim()
        val port = address.substringAfterLast(':', "").toIntOrNull() ?: 47800
        if (host.isNotEmpty()) hub.connectManual(host, port)
    }
}

@Composable
fun SettingsRoute(onBack: () -> Unit, vm: SettingsViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val tvs by vm.tvs.collectAsStateWithLifecycle()
    var address by remember { mutableStateOf("") }
    val c = Imlaq.colors
    HubPage(stringResource(R.string.set_title), onBack) {
        if (tvs.isNotEmpty()) {
            SectionLabel(stringResource(R.string.set_tvs))
            tvs.forEach { tv ->
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(tv.name, style = MaterialTheme.typography.titleMedium, color = c.text)
                            Text("${tv.host}:${tv.port}", style = MaterialTheme.typography.bodySmall, color = c.muted)
                        }
                        GhostButton(stringResource(R.string.set_forget), { vm.forget(tv) }, color = c.bad)
                    }
                }
            }
        }
        SectionLabel(stringResource(R.string.set_manual))
        GlassField(address, { address = it }, stringResource(R.string.set_manual_hint), trailing = { PillButton(stringResource(R.string.set_connect), { vm.connect(address) }, small = true) })
        GlassCard(padding = androidx.compose.foundation.layout.PaddingValues(4.dp)) {
            ToggleRow(stringResource(R.string.set_auto_keyboard), s.autoKeyboard, { v -> vm.update { it.copy(autoKeyboard = v) } })
            ToggleRow(stringResource(R.string.set_volume_keys), s.volumeKeysControlTv, { v -> vm.update { it.copy(volumeKeysControlTv = v) } })
        }
        SectionLabel(stringResource(R.string.set_language))
        SegmentedTabs(listOf(stringResource(R.string.set_lang_system), "العربية", "English"), s.language.ordinal, { i -> vm.update { it.copy(language = AppLanguage.entries[i]) } })
        GlassCard {
            KeyValueRow(stringResource(R.string.set_identity), vm.fingerprint)
            KeyValueRow(stringResource(R.string.set_version), "0.1.0")
        }
    }
}

