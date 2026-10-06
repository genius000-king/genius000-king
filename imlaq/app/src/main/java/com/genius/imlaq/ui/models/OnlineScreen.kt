package com.genius.imlaq.ui.models

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.genius.imlaq.R
import com.genius.imlaq.designsystem.CardShape
import com.genius.imlaq.designsystem.GhostButton
import com.genius.imlaq.designsystem.GlassField
import com.genius.imlaq.designsystem.IconCircle
import com.genius.imlaq.designsystem.Imlaq
import com.genius.imlaq.designsystem.ImlaqIcons
import com.genius.imlaq.designsystem.StatusDot
import com.genius.imlaq.designsystem.glass
import com.genius.imlaq.models.catalog.Fit
import com.genius.imlaq.models.catalog.FitLevel
import com.genius.imlaq.models.hub.HubModelFile
import com.genius.imlaq.models.hub.HubRepo
import java.util.Locale

interface OnlineActions {
    fun back()
    fun onQuery(q: String)
    fun search()
    fun open(repo: HubRepo)
    fun closeRepo()
    fun download(file: HubModelFile)
    fun onLink(link: String)
    fun downloadLink()
}

/**
 * Finding a model online: search Hugging Face, open a repo, pick a file. Or paste a direct
 * link from any other site.
 */
@Composable
fun OnlineScreen(
    state: OnlineUiState,
    fitForSize: (Long) -> Fit?,
    actions: OnlineActions,
    modifier: Modifier = Modifier,
) {
    val c = Imlaq.colors
    val repo = state.repo
    LazyColumn(
        modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconCircle(ImlaqIcons.Back, stringResource(R.string.online_back), onClick = { if (repo != null) actions.closeRepo() else actions.back() })
                Text(
                    repo?.id ?: stringResource(R.string.online_title),
                    style = MaterialTheme.typography.titleLarge,
                    color = c.text,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (repo == null) {
            item {
                GlassField(
                    value = state.query,
                    onValueChange = actions::onQuery,
                    placeholder = stringResource(R.string.online_search_hint),
                    leading = ImlaqIcons.Search,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { actions.search() }),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    IconCircle(ImlaqIcons.Search, stringResource(R.string.online_search), onClick = actions::search, filled = true, enabled = state.query.isNotBlank())
                }
            }
            item {
                Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.online_link_label), style = MaterialTheme.typography.bodySmall, color = c.muted, modifier = Modifier.padding(horizontal = 4.dp))
                    GlassField(
                        value = state.link,
                        onValueChange = actions::onLink,
                        placeholder = stringResource(R.string.online_link_hint),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = { actions.downloadLink() }),
                    ) {
                        IconCircle(ImlaqIcons.ArrowDown, stringResource(R.string.action_download), onClick = actions::downloadLink, filled = true, enabled = state.link.isNotBlank() && !state.checkingLink)
                    }
                }
            }
            state.error?.let { item { StatusDot(it, c.bad, Modifier.padding(horizontal = 4.dp)) } }
            when {
                state.searching -> item { Hint(stringResource(R.string.online_searching)) }
                state.results?.isEmpty() == true -> item { Hint(stringResource(R.string.online_no_results)) }
                else -> items(state.results.orEmpty(), key = { it.id }) { RepoCard(it, onClick = { actions.open(it) }) }
            }
        } else {
            state.error?.let { item { StatusDot(it, c.bad, Modifier.padding(horizontal = 4.dp)) } }
            val files = state.files
            when {
                files == null -> item { Hint(stringResource(R.string.online_loading_files)) }
                files.isEmpty() -> item { Hint(stringResource(R.string.online_no_files)) }
                else -> {
                    item { Hint(stringResource(R.string.online_pick_hint)) }
                    items(files, key = { it.label }) { f -> HubFileCard(f, fitForSize(f.totalBytes), onDownload = { actions.download(f) }) }
                }
            }
        }
    }
}

@Composable
private fun Hint(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = Imlaq.colors.faint, modifier = Modifier.padding(horizontal = 4.dp, vertical = 6.dp))
}

@Composable
private fun RepoCard(repo: HubRepo, onClick: () -> Unit) {
    val c = Imlaq.colors
    val owner = repo.id.substringBefore('/')
    val name = repo.id.substringAfter('/')
    Column(
        Modifier.fillMaxWidth().glass(CardShape).clickable(onClick = onClick).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(name, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 2)
        Text(owner, style = MaterialTheme.typography.bodySmall, color = c.muted)
        Text(
            stringResource(R.string.online_stats, compact(repo.downloads), compact(repo.likes)),
            style = MaterialTheme.typography.labelSmall,
            color = c.faint,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun HubFileCard(file: HubModelFile, fit: Fit?, onDownload: () -> Unit) {
    val canDownload = fit == null || fit.level != FitLevel.NO_SPACE
    ModelCard(
        title = file.label,
        bytes = file.totalBytes,
        action = { GhostButton(stringResource(R.string.action_download), onClick = onDownload, icon = ImlaqIcons.ArrowDown, enabled = canDownload) },
    ) {
        if (fit != null) FitLine(fit)
    }
}

/** 6928970 → "6.9M", the way download counts are read at a glance. */
internal fun compact(n: Long): String = when {
    n >= 1_000_000 -> String.format(Locale.US, "%.1fM", n / 1e6)
    n >= 1_000 -> String.format(Locale.US, "%.1fK", n / 1e3)
    else -> n.toString()
}
