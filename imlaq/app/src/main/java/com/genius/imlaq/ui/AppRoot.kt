package com.genius.imlaq.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.genius.imlaq.AppContainer
import com.genius.imlaq.R
import com.genius.imlaq.designsystem.GlassTopBar
import com.genius.imlaq.designsystem.IconCircle
import com.genius.imlaq.designsystem.Imlaq
import com.genius.imlaq.designsystem.ImlaqBackground
import com.genius.imlaq.designsystem.ImlaqIcons
import com.genius.imlaq.designsystem.SegmentedTabs
import com.genius.imlaq.models.catalog.CatalogEntry
import com.genius.imlaq.ui.chat.ChatActions
import com.genius.imlaq.ui.chat.ChatScreen
import com.genius.imlaq.ui.chat.ChatUiState
import com.genius.imlaq.ui.chat.ChatViewModel
import com.genius.imlaq.ui.models.InstalledRow
import com.genius.imlaq.ui.models.ModelsActions
import com.genius.imlaq.ui.models.ModelsScreen
import com.genius.imlaq.ui.models.ModelsUiState
import com.genius.imlaq.ui.models.ModelsViewModel

enum class Tab { MODELS, CHAT }

/** Wires the two screens to their view models. */
@Composable
fun AppRoot(container: AppContainer, dark: Boolean, onToggleTheme: () -> Unit) {
    val models = viewModel { ModelsViewModel(container) }
    val chat = viewModel { ChatViewModel(container.session) }
    val modelsState by models.state.collectAsStateWithLifecycle()
    val chatState by chat.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(Tab.MODELS) }
    var input by rememberSaveable { mutableStateOf("") }

    // Downloads and the loaded model show a notification; ask once, on the first action that needs it.
    val context = LocalContext.current
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    fun askForNotifications() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            permission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    AppFrame(
        tab = tab,
        onTab = { tab = it },
        dark = dark,
        onToggleTheme = onToggleTheme,
        models = modelsState,
        modelsActions = object : ModelsActions {
            override fun download(entry: CatalogEntry) { askForNotifications(); models.download(entry) }
            override fun cancelDownload(entry: CatalogEntry) = models.cancelDownload(entry)
            override fun run(row: InstalledRow) { askForNotifications(); models.run(row); tab = Tab.CHAT }
            override fun stop() = models.stop()
            override fun armDelete(row: InstalledRow?) = models.armDelete(row)
            override fun delete(row: InstalledRow) = models.delete(row)
        },
        chat = chatState,
        input = input,
        onInput = { input = it },
        chatActions = object : ChatActions {
            override fun send(text: String) = chat.send(text)
            override fun stop() = chat.stop()
            override fun newChat() = chat.newChat()
            override fun goToModels() { tab = Tab.MODELS }
        },
    )
}

/** The whole app: stone backdrop, the floating bar with the two tabs, and the current screen. */
@Composable
fun AppFrame(
    tab: Tab,
    onTab: (Tab) -> Unit,
    dark: Boolean,
    onToggleTheme: () -> Unit,
    models: ModelsUiState,
    modelsActions: ModelsActions,
    chat: ChatUiState,
    input: String,
    onInput: (String) -> Unit,
    chatActions: ChatActions,
) {
    val c = Imlaq.colors
    ImlaqBackground {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
            GlassTopBar(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(stringResource(R.string.app_name), style = MaterialTheme.typography.titleLarge, color = c.text)
                Spacer(Modifier.weight(1f))
                SegmentedTabs(
                    options = listOf(stringResource(R.string.tab_models), stringResource(R.string.tab_chat)),
                    selected = tab.ordinal,
                    onSelect = { onTab(Tab.entries[it]) },
                )
                IconCircle(
                    icon = if (dark) ImlaqIcons.Sun else ImlaqIcons.Moon,
                    contentDescription = stringResource(if (dark) R.string.theme_light else R.string.theme_dark),
                    onClick = onToggleTheme,
                )
            }
            Box(Modifier.weight(1f)) {
                when (tab) {
                    Tab.MODELS -> ModelsScreen(models, modelsActions)
                    Tab.CHAT -> ChatScreen(chat, input, onInput, chatActions)
                }
            }
        }
    }
}
