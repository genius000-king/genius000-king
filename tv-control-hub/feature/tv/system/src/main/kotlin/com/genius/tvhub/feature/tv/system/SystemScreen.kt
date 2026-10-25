package com.genius.tvhub.feature.tv.system

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.CardShape
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.LivingBackground
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.designsystem.tvFocus

/**
 * The TV's settings: a short list of sections on one side, the focused section on the other.
 * Moving down the list switches the content at once — no "enter" needed.
 */
@Composable
fun SystemScreen(state: SystemState, actions: SystemActions, modifier: Modifier = Modifier, initial: Section = Section.INTERFACE) {
    var section by rememberSaveable { mutableStateOf(initial) }
    val first = remember { FocusRequester() }
    LivingBackground(modifier, motion = state.settings.motion) {
        Row(Modifier.fillMaxSize().padding(horizontal = 56.dp, vertical = 40.dp), horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            Column(Modifier.width(280.dp).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(stringResource(R.string.sys_title), style = MaterialTheme.typography.headlineMedium, color = Imlaq.colors.text, modifier = Modifier.padding(start = 8.dp, bottom = 18.dp))
                Section.entries.forEachIndexed { i, s ->
                    val needsSetup = s == Section.SETUP && state.setup.any { !it.done }
                    SectionRow(s.icon(), stringResource(s.label()), selected = s == section, dot = needsSetup, modifier = if (i == 0) Modifier.focusRequester(first) else Modifier) { section = s }
                }
            }
            Column(
                Modifier.weight(1f).fillMaxHeight().glass(CardShape).padding(24.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                when (section) {
                    Section.INTERFACE -> InterfaceSection(state.settings, actions)
                    Section.PHONES -> PhonesSection(state, actions)
                    Section.SETUP -> SetupSection(state.setup, actions)
                    Section.SYSTEM -> SystemSection(state.settings, actions)
                    Section.SERVICES -> ServicesSection(state.services)
                    Section.ABOUT -> AboutSection(state)
                }
            }
        }
    }
    LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
}

@Composable
private fun SectionRow(icon: ImageVector, label: String, selected: Boolean, dot: Boolean, modifier: Modifier, onFocus: () -> Unit) {
    val c = Imlaq.colors
    Row(
        modifier.fillMaxWidth()
            .onFocusChanged { if (it.isFocused) onFocus() }
            .tvFocus(PillShape)
            .then(if (selected) Modifier.glass(PillShape, strong = true) else Modifier)
            .clickable(onClick = onFocus)
            .padding(horizontal = 18.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(icon, null, tint = if (selected) c.text else c.muted, modifier = Modifier.size(18.dp))
        Text(label, style = MaterialTheme.typography.titleMedium, color = if (selected) c.text else c.muted, modifier = Modifier.weight(1f))
        if (dot) Box(Modifier.size(8.dp).background(c.warn, androidx.compose.foundation.shape.CircleShape))
    }
}

private fun Section.icon() = when (this) {
    Section.INTERFACE -> HubIcons.Palette
    Section.PHONES -> HubIcons.Devices
    Section.SETUP -> HubIcons.Check
    Section.SYSTEM -> ImlaqIcons.Settings
    Section.SERVICES -> HubIcons.Server
    Section.ABOUT -> HubIcons.Info
}

private fun Section.label() = when (this) {
    Section.INTERFACE -> R.string.sys_interface
    Section.PHONES -> R.string.sys_phones
    Section.SETUP -> R.string.sys_setup
    Section.SYSTEM -> R.string.sys_system
    Section.SERVICES -> R.string.sys_services
    Section.ABOUT -> R.string.sys_about
}

@Composable
internal fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleLarge, color = Imlaq.colors.text, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
internal fun Gap() = Spacer(Modifier.height(6.dp))
