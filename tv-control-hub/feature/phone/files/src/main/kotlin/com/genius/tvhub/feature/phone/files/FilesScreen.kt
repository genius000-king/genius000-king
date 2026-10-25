package com.genius.tvhub.feature.phone.files

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.tvhub.core.common.formatBytes
import com.genius.tvhub.core.designsystem.CapsuleField
import com.genius.tvhub.core.designsystem.EmptyState
import com.genius.tvhub.core.designsystem.GlassDialog
import com.genius.tvhub.core.designsystem.GlassSheet
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.HubPage
import com.genius.tvhub.core.designsystem.IconCircle
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.MenuRow
import com.genius.tvhub.core.designsystem.PillButton
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.ProgressTrack
import com.genius.tvhub.core.model.FileEntry
import com.genius.tvhub.core.model.RemotePath

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FilesRoute(onBack: () -> Unit, vm: FilesViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val c = Imlaq.colors
    var menu by remember { mutableStateOf<FileEntry?>(null) }
    var naming by remember { mutableStateOf<Pair<FileEntry?, String>?>(null) } // (entry to rename or null = new folder, text)
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(vm::upload) }
    BackHandler { if (!vm.up()) onBack() }

    HubPage(s.dir?.path?.ifEmpty { null }?.substringAfterLast('/') ?: stringResource(R.string.files_title), { if (!vm.up()) onBack() }, scroll = false,
        action = { IconCircle(ImlaqIcons.Plus, stringResource(R.string.files_new_folder), { naming = null to "" }) }) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(s.roots, key = { it.id }) { root ->
                val on = s.dir?.root == root.id
                Box(Modifier.background(if (on) c.accent else c.line, PillShape).clickable { vm.open(RemotePath(root.id)) }.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    Text(root.label, style = MaterialTheme.typography.labelMedium, color = if (on) c.onAccent else c.text)
                }
            }
        }
        s.progress?.let { ProgressTrack(it) }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (s.entries.isEmpty() && s.dir != null) EmptyState(HubIcons.Folder, stringResource(R.string.files_empty), "")
            LazyColumn(contentPadding = PaddingValues(bottom = 96.dp)) {
                items(s.entries, key = { it.path.path }) { e ->
                    Row(
                        Modifier.fillMaxWidth().combinedClickable(onClick = { if (e.isDirectory) vm.open(e.path) else menu = e }, onLongClick = { menu = e }).padding(vertical = 12.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Icon(if (e.isDirectory) HubIcons.Folder else ImlaqIcons.File, null, tint = if (e.isDirectory) c.text else c.muted, modifier = Modifier.size(22.dp))
                        Column(Modifier.weight(1f)) {
                            Text(e.name, color = c.text, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.MiddleEllipsis)
                            if (!e.isDirectory) Text(formatBytes(e.size), color = c.faint, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            PillButton(stringResource(R.string.files_upload), { picker.launch(arrayOf("*/*")) }, icon = HubIcons.Upload,
                modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 12.dp))
        }
    }

    menu?.let { e ->
        GlassSheet(e.name, { menu = null }) {
            if (!e.isDirectory) MenuRow(stringResource(R.string.files_download), HubIcons.Download, { menu = null; vm.download(e) })
            MenuRow(stringResource(R.string.files_rename), ImlaqIcons.Edit, { menu = null; naming = e to e.name })
            MenuRow(stringResource(R.string.files_delete), ImlaqIcons.Trash, { menu = null; vm.delete(e) })
        }
    }
    naming?.let { (entry, text) ->
        var value by remember(entry) { mutableStateOf(text) }
        GlassDialog(if (entry == null) stringResource(R.string.files_new_folder) else stringResource(R.string.files_rename), { naming = null },
            actions = { PillButton(stringResource(R.string.files_ok), { if (entry == null) vm.mkdir(value) else vm.rename(entry, value); naming = null }, small = true) }) {
            CapsuleField(stringResource(R.string.files_name), value, { value = it })
        }
    }
    s.message?.let { msg -> LaunchedEffect(msg) { kotlinx.coroutines.delay(2500); vm.messageShown() }
        Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp), contentAlignment = Alignment.BottomCenter) {
            Text(msg, color = c.text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.background(c.glassHi, PillShape).padding(horizontal = 16.dp, vertical = 10.dp))
        }
    }
}
