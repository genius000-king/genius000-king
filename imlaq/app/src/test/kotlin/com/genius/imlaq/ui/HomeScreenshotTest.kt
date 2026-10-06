package com.genius.imlaq.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.designsystem.ImlaqTheme
import com.genius.imlaq.device.CpuCore
import com.genius.imlaq.device.DeviceProfile
import com.genius.imlaq.memory.MemorySnapshot
import com.genius.imlaq.models.LocalModel
import com.genius.imlaq.models.ModelKind
import com.genius.imlaq.models.ModelSummary
import com.genius.imlaq.models.SpeedEstimator
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renders the home screen with sample data in both themes and writes the PNGs to
 * app/build/screenshots/ — a look at the UI without a phone or an emulator.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w411dp-h2200dp-xxhdpi")
class HomeScreenshotTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun dark() = capture(dark = true, name = "home-dark")

    @Test
    fun light() = capture(dark = false, name = "home-light")

    private fun capture(dark: Boolean, name: String) {
        compose.setContent {
            ImlaqTheme(dark = dark) { HomeScreen(sampleState(), dark = dark, onToggleTheme = {}) }
        }
        val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        val out = File("build/screenshots").apply { mkdirs() }.resolve("$name.png")
        out.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun sampleState(): HomeState {
        val budget = Bytes.gib(7.4)
        val moe = ModelSummary(
            kind = ModelKind.TEXT_MOE, architecture = "gpt-oss", name = "gpt-oss-120b",
            expertCount = 128, expertUsedCount = 4, blockCount = 36, contextLength = 131072,
            totalBytes = Bytes.gib(60), expertBytes = Bytes.gib(57), denseBytes = Bytes.gib(3),
        )
        val dense = moe.copy(
            kind = ModelKind.TEXT_DENSE, architecture = "llama", name = "Llama 70B",
            expertCount = 0, expertUsedCount = 0, totalBytes = Bytes.gib(42),
            expertBytes = Bytes.ZERO, denseBytes = Bytes.gib(42),
        )
        fun row(s: ModelSummary) = ModelRow(
            LocalModel(File("/m/${s.name}.gguf"), listOf(File("/m/${s.name}.gguf")), s, null),
            SpeedEstimator.estimate(s, budget, HomeViewModel.ASSUMED_FLASH_BYTES_PER_S, HomeViewModel.ASSUMED_RAM_BYTES_PER_S),
        )
        return HomeState(
            loading = false,
            profile = DeviceProfile(
                manufacturer = "OnePlus", model = "15R", socModel = "SM8750", socManufacturer = "QTI",
                sdkInt = 36, abis = listOf("arm64-v8a"),
                cores = List(6) { CpuCore(it, 3_530_000) } + List(2) { CpuCore(6 + it, 4_320_000) },
                memory = MemorySnapshot(total = Bytes.gib(12), available = Bytes.gib(6.2)),
                lowMemoryThreshold = Bytes.gib(0.5),
                modelStorageFree = Bytes.gib(181),
                thermalHeadroom = 0.31f,
            ),
            reserve = Bytes.gib(1.8),
            budget = budget,
            textEngineBundled = true,
            modelsDir = "/data/user/0/com.genius.imlaq/files/models",
            models = listOf(row(moe), row(dense)),
        )
    }
}
