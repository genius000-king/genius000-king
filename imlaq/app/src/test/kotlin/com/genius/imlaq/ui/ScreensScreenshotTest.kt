package com.genius.imlaq.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.designsystem.ImlaqTheme
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.models.ModelKind
import com.genius.imlaq.models.ModelSummary
import com.genius.imlaq.models.catalog.Catalog
import com.genius.imlaq.models.catalog.Fit
import com.genius.imlaq.models.catalog.FitLevel
import com.genius.imlaq.models.download.DownloadState
import com.genius.imlaq.session.SessionModel
import com.genius.imlaq.session.SessionState
import com.genius.imlaq.ui.chat.ChatActions
import com.genius.imlaq.ui.chat.ChatMessage
import com.genius.imlaq.ui.chat.ChatUiState
import com.genius.imlaq.ui.models.AvailableRow
import com.genius.imlaq.ui.models.InstalledRow
import com.genius.imlaq.ui.models.ModelsActions
import com.genius.imlaq.ui.models.ModelsUiState
import com.genius.imlaq.ui.models.RunStatus
import com.genius.imlaq.models.catalog.CatalogEntry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renders both screens with sample data, in the dark and light themes, into
 * app/build/screenshots/ — a look at the real Compose UI without a phone or an emulator.
 * (Robolectric draws no backdrop blur; on a phone with Android 12+ the glass is frosted.)
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w393dp-h852dp-xxhdpi")
class ScreensScreenshotTest {

    @get:Rule
    val compose = createComposeRule()

    @Test fun modelsDark() = shot("models-dark", dark = true, tab = Tab.MODELS)
    @Test fun modelsLight() = shot("models-light", dark = false, tab = Tab.MODELS)
    @Test fun chatDark() = shot("chat-dark", dark = true, tab = Tab.CHAT)
    @Test fun chatLight() = shot("chat-light", dark = false, tab = Tab.CHAT)

    private fun shot(name: String, dark: Boolean, tab: Tab) {
        compose.setContent {
            ImlaqTheme(dark = dark) {
                AppFrame(
                    tab = tab, onTab = {}, dark = dark, onToggleTheme = {},
                    models = sampleModels(), modelsActions = NoModelsActions,
                    chat = sampleChat(), input = "", onInput = {}, chatActions = NoChatActions,
                )
            }
        }
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        File("build/screenshots").apply { mkdirs() }.resolve("$name.png").outputStream().use {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    private fun sampleModels(): ModelsUiState {
        val qwen = Catalog.byId("qwen3-30b")!!
        val file = File("/m/${qwen.entryFileName}")
        val summary = ModelSummary(ModelKind.TEXT_MOE, "qwen3moe", "Qwen3 30B", 128, 8, 48, 40960,
            Bytes(qwen.totalBytes), Bytes(qwen.totalBytes - 1_500_000_000L), Bytes(1_500_000_000L))
        fun row(id: String, fit: FitLevel, dl: DownloadState = DownloadState.Idle) =
            AvailableRow(Catalog.byId(id)!!, Fit(fit), dl)
        return ModelsUiState(
            loading = false,
            installed = listOf(InstalledRow(LocalModel(file, listOf(file), summary, null), "Qwen3 30B", qwen.totalBytes, RunStatus.IDLE)),
            available = listOf(
                row("gemma4-26b", FitLevel.GOOD, DownloadState.Running(7_160_000_000L, 17_035_038_112L)),
                row("qwen3.6-35b", FitLevel.GOOD),
                row("gpt-oss-120b", FitLevel.SLOW),
                AvailableRow(Catalog.byId("deepseek-v4-flash")!!, Fit(FitLevel.NO_SPACE, Bytes(12_400_000_000L)), DownloadState.Idle),
            ),
        )
    }

    private fun sampleChat() = ChatUiState(
        session = SessionState.Ready(SessionModel("Qwen3 30B", File("/m/q.gguf"))),
        messages = listOf(
            ChatMessage(1, fromUser = true, text = "ليش النموذج الكبير يشتغل على جوالي وهو أكبر من الرام؟"),
            ChatMessage(2, fromUser = false, text = "لأن التطبيق ما يحمّل النموذج كله. الجزء اللي يحتاجه كل توكن يبقى في الرام، والباقي ينقرا من التخزين وقت ما ينطلب. يعني يشتغل، بس أبطأ من نموذج يدخل الرام كامل.", tokensPerSecond = 5.2),
            ChatMessage(3, fromUser = true, text = "طيب وش أنزّل عشان يكون أسرع شي؟"),
            ChatMessage(4, fromUser = false, text = "", thinking = true),
        ),
        generating = true,
    )

    private object NoModelsActions : ModelsActions {
        override fun download(entry: CatalogEntry) = Unit
        override fun cancelDownload(entry: CatalogEntry) = Unit
        override fun run(row: InstalledRow) = Unit
        override fun stop() = Unit
        override fun armDelete(row: InstalledRow?) = Unit
        override fun delete(row: InstalledRow) = Unit
    }

    private object NoChatActions : ChatActions {
        override fun send(text: String) = Unit
        override fun stop() = Unit
        override fun newChat() = Unit
        override fun goToModels() = Unit
    }
}
