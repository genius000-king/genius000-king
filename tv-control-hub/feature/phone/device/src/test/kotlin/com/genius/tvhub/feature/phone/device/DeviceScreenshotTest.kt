package com.genius.tvhub.feature.phone.device

import androidx.compose.ui.test.junit4.createComposeRule
import com.genius.tvhub.core.designsystem.ImlaqTheme
import com.genius.tvhub.core.model.CpuReading
import com.genius.tvhub.core.model.DeviceProfile
import com.genius.tvhub.core.model.LinkKind
import com.genius.tvhub.core.model.MemoryReading
import com.genius.tvhub.core.model.MetricsSnapshot
import com.genius.tvhub.core.model.NetworkReading
import com.genius.tvhub.core.model.Reading
import com.genius.tvhub.core.model.StorageReading
import com.genius.tvhub.core.model.ThermalLevel
import com.genius.tvhub.core.model.ThermalReading
import com.github.takahirom.roborazzi.captureScreenRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The device page with the readings a Xiaomi TV Box S really gives an app — and the ones it does not. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w400dp-h900dp-xxhdpi")
class DeviceScreenshotTest {
    @get:Rule val compose = createComposeRule()

    private val gb = 1024L * 1024 * 1024
    private val state = DeviceState(
        profile = DeviceProfile(
            "Xiaomi", "MiTV-AFKR0", "14", 34, "2026-09-01", Reading.of("Amlogic S905X5M"), listOf("arm64-v8a"), 4,
            Reading.of(listOf(2_500_000L, 2_500_000L, 2_500_000L, 2_500_000L)), Reading.of("Mali-G310"), Reading.of("ARM"), Reading.of("OpenGL ES 3.2"), 1920, 1080, 60f, 2 * gb,
        ),
        now = MetricsSnapshot(
            0, 26L * 3600 * 1000 + 15 * 60_000,
            MemoryReading(2 * gb, (0.8 * gb).toLong(), false, 100), listOf(StorageReading("internal", "Internal", 32 * gb, 19 * gb, false)),
            CpuReading(Reading.of(listOf(1_200_000L, 1_800_000L, 600_000L, 2_000_000L)), Reading.needsAdb("Android 8+ blocks /proc/stat for apps"), 0.03f),
            ThermalReading(Reading.of(ThermalLevel.NONE), Reading.of(0.4f), Reading.needsAdb("thermal zones are not readable by apps")),
            NetworkReading(LinkKind.WIFI, listOf("192.168.1.20"), Reading.of(-52), Reading.of(433), 1_400_000, 90_000), 180L * 1024 * 1024,
        ),
        memoryHistory = List(40) { 0.55f + 0.08f * kotlin.math.sin(it / 5f) },
        rxHistory = List(40) { (800_000 + 600_000 * kotlin.math.sin(it / 3f)).toFloat() },
    )

    @Test fun arabic() {
        RuntimeEnvironment.setQualifiers("+ar")
        compose.setContent { ImlaqTheme(rtl = true) { DeviceScreen(state) {} } }
        compose.mainClock.advanceTimeBy(1000)
        captureScreenRoboImage("build/outputs/roborazzi/phone_device_ar.png")
    }
}
