package com.genius.tvhub.feature.phone.remote

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import com.genius.tvhub.core.designsystem.ImlaqTheme
import com.genius.tvhub.core.model.Grants
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.LinkFailure
import com.genius.tvhub.core.model.LinkState
import com.genius.tvhub.core.model.TvEndpoint
import com.github.takahirom.roborazzi.captureScreenRoboImage
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w400dp-h860dp-xxhdpi")
class RemoteScreenshotTest {
    @get:Rule val compose = createComposeRule()

    private val tv = TvEndpoint("id", "Xiaomi TV Box", "192.168.1.20", 47800, paired = true)
    private val pressed = mutableListOf<Any>()
    private val actions = object : RemoteActions {
        override fun key(action: KeyAction) { pressed += action }
        override fun open(destination: Destination) { pressed += destination }
        override fun connect(tv: TvEndpoint) { pressed += tv }
        override fun retry() {}
        override fun manualAddress() {}
        override fun hintSeen() {}
    }

    private fun shot(name: String, state: LinkState, rtl: Boolean = true, dark: Boolean = true, hint: Boolean = true, after: () -> Unit = {}) {
        if (rtl) org.robolectric.RuntimeEnvironment.setQualifiers("+ar")
        compose.setContent { ImlaqTheme(dark = dark, rtl = rtl) { com.genius.tvhub.core.designsystem.OverlayHost { RemoteScreen(state, actions, showHint = hint) } } }
        after()
        compose.waitForIdle()
        captureScreenRoboImage("build/outputs/roborazzi/remote_$name.png")
    }

    @Test fun connected() = shot("connected_ar", LinkState.Connected(tv, 12, Grants.DEFAULT))
    @Test fun connectedEnglish() = shot("connected_en", LinkState.Connected(tv, 9, Grants.DEFAULT), rtl = false)
    @Test fun searching() = shot("searching_ar", LinkState.Searching(listOf(tv.copy(paired = false))))
    @Test fun approval() = shot("approval_ar", LinkState.AwaitingApproval(tv, "482913"))
    @Test fun failed() = shot("failed_ar", LinkState.Failed(tv, LinkFailure.KEY_CHANGED))

    @Test fun deckOpensFromTheMoreOrb() = shot("deck_ar", LinkState.Connected(tv, 12, Grants.DEFAULT), hint = false) {
        compose.onNodeWithContentDescription("المزيد").performClick()
        compose.mainClock.advanceTimeBy(800)
    }

    @Test fun orbsSendKeys() {
        compose.setContent { ImlaqTheme(rtl = false) { RemoteScreen(LinkState.Connected(tv, 1, Grants.DEFAULT), actions, showHint = false) } }
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Home").performClick()
        assertThat(pressed).containsExactly(KeyAction.BACK, KeyAction.HOME).inOrder()
    }
}
