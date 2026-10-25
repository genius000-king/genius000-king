package com.genius.tvhub.feature.phone.apps

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.tvhub.core.common.formatBytes
import com.genius.tvhub.core.designsystem.GlassField
import com.genius.tvhub.core.designsystem.GlassSheet
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.HubPage
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.MenuRow
import com.genius.tvhub.core.designsystem.PillButton
import com.genius.tvhub.core.designsystem.ProgressTrack
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.model.AppInfo

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AppsRoute(onBack: () -> Unit, vm: AppsViewModel = hiltViewModel()) {
    val apps by vm.tvApps.collectAsStateWithLifecycle()
    val icons by vm.icons.collectAsStateWithLifecycle()
    val phoneApps by vm.phoneApps.collectAsStateWithLifecycle()
    val beam by vm.beam.collectAsStateWithLifecycle()
    var menu by remember { mutableStateOf<AppInfo?>(null) }
    val c = Imlaq.colors

    HubPage(stringResource(R.string.apps_title), onBack, scroll = false) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            LazyVerticalGrid(GridCells.Adaptive(84.dp), contentPadding = PaddingValues(bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                items(apps, key = { it.packageName }) { app ->
                    Column(
                        Modifier.combinedClickable(onClick = { vm.launch(app) }, onLongClick = { menu = app }).padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        val icon = icons[app.packageName]
                        Box(Modifier.size(60.dp).clip(RoundedCornerShape(16.dp)).background(c.line), contentAlignment = Alignment.Center) {
                            if (icon != null) Image(icon, app.label, Modifier.size(60.dp))
                        }
                        Text(app.label, style = MaterialTheme.typography.labelSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                        if (!app.isTvApp) Text(stringResource(R.string.apps_phone_app), style = MaterialTheme.typography.labelSmall, color = c.faint, maxLines = 1)
                    }
                }
            }
            Column(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                beam?.let { BeamStatus(it, vm::dismissBeam) }
                PillButton(stringResource(R.string.apps_beam), vm::openBeam, icon = HubIcons.Beam)
            }
        }
    }

    menu?.let { app ->
        GlassSheet(app.label, { menu = null }) {
            MenuRow(stringResource(R.string.apps_open), ImlaqIcons.Play, { menu = null; vm.launch(app) })
            MenuRow(stringResource(R.string.apps_uninstall), ImlaqIcons.Trash, { menu = null; vm.uninstall(app) })
        }
    }
    phoneApps?.let { list -> BeamSheet(list, vm::send, vm::closeBeam) }
}

@Composable
private fun BeamStatus(beam: Beam, onDismiss: () -> Unit) {
    val c = Imlaq.colors
    Column(Modifier.padding(bottom = 10.dp).fillMaxWidth().glass(RoundedCornerShape(22.dp), strong = true).combinedClickableSafe(onDismiss).padding(16.dp)) {
        when (beam) {
            is Beam.Sending -> { Text(stringResource(R.string.apps_sending, beam.label, (beam.progress * 100).toInt()), color = c.text, style = MaterialTheme.typography.labelMedium); ProgressTrack(beam.progress, Modifier.padding(top = 8.dp)) }
            is Beam.Confirm -> Text(stringResource(R.string.apps_confirm), color = c.warn, style = MaterialTheme.typography.labelMedium)
            is Beam.Done -> Text(stringResource(R.string.apps_done, beam.label), color = c.ok, style = MaterialTheme.typography.labelMedium)
            is Beam.Failed -> Text(stringResource(R.string.apps_failed, beam.reason), color = c.bad, style = MaterialTheme.typography.labelMedium)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
private fun Modifier.combinedClickableSafe(onClick: () -> Unit) = this.then(Modifier.combinedClickable(onClick = onClick))

/** The phone's own apps, searchable; one tap sends it to the TV. */
@Composable
private fun BeamSheet(apps: List<com.genius.tvhub.engine.apps.beam.BeamableApp>, onSend: (com.genius.tvhub.engine.apps.beam.BeamableApp) -> Unit, onClose: () -> Unit) {
    val c = Imlaq.colors
    val pm = LocalContext.current.packageManager
    var query by remember { mutableStateOf("") }
    GlassSheet(stringResource(R.string.apps_beam_title), onClose) {
        GlassField(query, { query = it }, stringResource(R.string.apps_search), leading = ImlaqIcons.Search)
        LazyColumn(Modifier.heightIn(max = 420.dp)) {
            items(apps.filter { query.isBlank() || it.label.contains(query, ignoreCase = true) }, key = { it.packageName }) { app ->
                Row(
                    Modifier.fillMaxWidth().combinedClickableSafe { onSend(app) }.padding(vertical = 10.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    val icon = remember(app.packageName) { runCatching { pm.getApplicationIcon(app.packageName).toBitmap(96, 96).asImageBitmap() }.getOrNull() }
                    if (icon != null) Image(icon, null, Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)))
                    Column(Modifier.weight(1f)) {
                        Text(app.label, color = c.text, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                        Text("${formatBytes(app.totalBytes)} · ${app.files.size} APK", color = c.muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

