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
import com.genius.imlaq.models.catalog.FitJudge
import com.genius.imlaq.models.download.ActiveTransfer
import com.genius.imlaq.models.download.DownloadSpec
import com.genius.imlaq.models.download.TransferFile
import com.genius.imlaq.models.hub.HubModelFile
import com.genius.imlaq.models.hub.HubRepo
import com.genius.imlaq.ui.models.OnlineActions
import com.genius.imlaq.ui.models.OnlineUiState
import com.genius.imlaq.ui.models.SuggestedRow
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
    @Test fun onlineSearchDark() = shot("online-search-dark", dark = true, tab = Tab.MODELS, page = ModelsPage.ONLINE, online = sampleSearch())
    @Test fun onlineFilesDark() = shot("online-files-dark", dark = true, tab = Tab.MODELS, page = ModelsPage.ONLINE, online = sampleFiles())
    @Test fun chatDark() = shot("chat-dark", dark = true, tab = Tab.CHAT)
    @Test fun chatLight() = shot("chat-light", dark = false, tab = Tab.CHAT)

    private fun shot(name: String, dark: Boolean, tab: Tab, page: ModelsPage = ModelsPage.LIST, online: OnlineUiState = OnlineUiState()) {
        compose.setContent {
            ImlaqTheme(dark = dark) {
                AppFrame(
                    tab = tab, onTab = {}, dark = dark, onToggleTheme = {},
                    modelsPage = page, models = sampleModels(), modelsActions = NoModelsActions,
                    online = online, fitForSize = ::sampleFit, onlineActions = NoOnlineActions,
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
        val hubGemma = DownloadSpec("hf:x", "gemma-3-27b-it-Q4_K_M", listOf(TransferFile("gemma-3-27b-it-Q4_K_M.gguf", "https://x", 16_550_000_000L)))
        return ModelsUiState(
            loading = false,
            installed = listOf(InstalledRow(LocalModel(file, listOf(file), summary, null), "Qwen3 30B", qwen.totalBytes, RunStatus.IDLE)),
            transfers = listOf(ActiveTransfer(hubGemma, DownloadState.Running(6_900_000_000L, 16_550_000_000L))),
            suggested = listOf(
                SuggestedRow(Catalog.byId("gemma4-26b")!!, Fit(FitLevel.GOOD)),
                SuggestedRow(Catalog.byId("gpt-oss-120b")!!, Fit(FitLevel.SLOW)),
                SuggestedRow(Catalog.byId("deepseek-v4-flash")!!, Fit(FitLevel.NO_SPACE, Bytes(12_400_000_000L))),
            ),
        )
    }

    private fun sampleFit(bytes: Long): Fit = FitJudge.assessSize(bytes, Bytes.gib(11.2), Bytes(60_000_000_000L))

    private fun sampleSearch() = OnlineUiState(
        query = "qwen3 30b",
        results = listOf(
            HubRepo("unsloth/Qwen3-30B-A3B-GGUF", 1_250_000, 410),
            HubRepo("unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF", 6_928_970, 1113),
            HubRepo("bartowski/Qwen_Qwen3-30B-A3B-GGUF", 312_000, 95),
        ),
    )

    private fun sampleFiles(): OnlineUiState {
        fun f(label: String, bytes: Long) = HubModelFile("unsloth/Qwen3-30B-A3B-GGUF", label, listOf(TransferFile("$label.gguf", "https://x", bytes)))
        return OnlineUiState(
            query = "qwen3 30b",
            repo = HubRepo("unsloth/Qwen3-30B-A3B-GGUF", 1_250_000, 410),
            files = listOf(
                f("Qwen3-30B-A3B-Q2_K", 11_258_610_432L),
                f("Qwen3-30B-A3B-Q4_K_M", 18_556_686_912L),
                f("Qwen3-30B-A3B-Q8_0", 32_483_935_424L),
                f("Qwen3-30B-A3B-BF16", 61_095_803_424L),
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
        override fun addFromPhone() = Unit
        override fun addFromInternet() = Unit
        override fun downloadSuggested(entry: CatalogEntry) = Unit
        override fun cancel(transfer: ActiveTransfer) = Unit
        override fun retry(transfer: ActiveTransfer) = Unit
        override fun run(row: InstalledRow) = Unit
        override fun stop() = Unit
        override fun armDelete(row: InstalledRow?) = Unit
        override fun delete(row: InstalledRow) = Unit
    }

    private object NoOnlineActions : OnlineActions {
        override fun back() = Unit
        override fun onQuery(q: String) = Unit
        override fun search() = Unit
        override fun open(repo: HubRepo) = Unit
        override fun closeRepo() = Unit
        override fun download(file: HubModelFile) = Unit
        override fun onLink(link: String) = Unit
        override fun downloadLink() = Unit
    }

    private object NoChatActions : ChatActions {
        override fun send(text: String) = Unit
        override fun stop() = Unit
        override fun newChat() = Unit
        override fun goToModels() = Unit
    }
}
