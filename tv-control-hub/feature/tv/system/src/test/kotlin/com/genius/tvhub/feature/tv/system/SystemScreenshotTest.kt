package com.genius.tvhub.feature.tv.system

import androidx.compose.ui.test.junit4.createComposeRule
import com.genius.tvhub.core.designsystem.Effects
import com.genius.tvhub.core.designsystem.ImlaqTheme
import com.genius.tvhub.core.designsystem.LivingBackground
import com.genius.tvhub.core.model.AppLanguage
import com.genius.tvhub.core.model.Grant
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.HubSettings
import com.genius.tvhub.core.model.ServiceState
import com.github.takahirom.roborazzi.captureScreenRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-television-xhdpi")
class SystemScreenshotTest {
    @get:Rule val compose = createComposeRule()

    private val state = SystemState(
        settings = HubSettings(),
        phones = listOf(PhoneRow("p1", "Galaxy S24", "samsung SM-S921B", Grants.DEFAULT, connected = true)),
        setup = listOf(SetupItem(SetupKind.ACCESSIBILITY, true), SetupItem(SetupKind.INSTALL, false), SetupItem(SetupKind.FILES, false), SetupItem(SetupKind.HOME, true)),
        services = listOf(ServiceRow("Web server", ServiceState.RUNNING)),
        version = "0.1.0", fingerprint = "a1b2 c3d4", address = "192.168.1.20:47800",
    )
    private val actions = object : SystemActions {
        override fun update(change: (HubSettings) -> HubSettings) {}
        override fun setGrant(phoneId: String, grant: Grant, on: Boolean) {}
        override fun revoke(phoneId: String) {}
        override fun openSetup(kind: SetupKind) {}
        override fun setLanguage(language: AppLanguage) {}
    }

    private fun shot(name: String, section: Section) {
        RuntimeEnvironment.setQualifiers("+ar")
        compose.setContent { ImlaqTheme(rtl = true, effects = Effects.LITE) { SystemScreen(state, actions, initial = section) } }
        compose.mainClock.advanceTimeBy(800)
        captureScreenRoboImage("build/outputs/roborazzi/tv_system_$name.png")
    }

    @Test fun interfaceSection() = shot("interface", Section.INTERFACE)
    @Test fun phonesSection() = shot("phones", Section.PHONES)
    @Test fun setupSection() = shot("setup", Section.SETUP)

    @Test fun pairingPrompt() {
        RuntimeEnvironment.setQualifiers("+ar")
        compose.setContent {
            ImlaqTheme(rtl = true, effects = Effects.LITE) {
                LivingBackground { PairingPrompt("Galaxy S24", "482913", {}, {}) }
            }
        }
        compose.mainClock.advanceTimeBy(1200)
        captureScreenRoboImage("build/outputs/roborazzi/tv_pairing.png")
    }
}
