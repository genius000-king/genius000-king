package com.genius.tvhub.engine.input

import android.accessibilityservice.AccessibilityService
import android.media.AudioManager
import android.view.KeyEvent
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.engine.input.cursor.CursorModel
import com.genius.tvhub.engine.input.cursor.RemoteMouse
import com.genius.tvhub.engine.input.gesture.GesturePlanner
import com.genius.tvhub.engine.input.keys.KeyRoute
import com.genius.tvhub.engine.input.keys.KeyRouter
import com.genius.tvhub.engine.input.text.TextEditor
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class KeyRouterTest {
    @Test fun everyActionHasARoute() {
        KeyAction.entries.forEach { assertThat(KeyRouter.route(it, 34)).isNotInstanceOf(KeyRoute.Unsupported::class.java) }
    }

    @Test fun dpadNeedsAndroid13() {
        assertThat(KeyRouter.route(KeyAction.UP, 34)).isEqualTo(KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_DPAD_UP))
        assertThat(KeyRouter.route(KeyAction.UP, 31)).isInstanceOf(KeyRoute.Unsupported::class.java)
        assertThat(KeyRouter.route(KeyAction.BACK, 29)).isEqualTo(KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_BACK))
    }

    @Test fun volumeAndMediaNeedNoAccessibility() {
        val vol = KeyRouter.route(KeyAction.VOLUME_UP, 34)
        assertThat(vol).isEqualTo(KeyRoute.Volume(AudioManager.ADJUST_RAISE))
        assertThat(KeyRouter.needsAccessibility(vol)).isFalse()
        assertThat(KeyRouter.route(KeyAction.PLAY_PAUSE, 34)).isEqualTo(KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
    }
}

class GesturePlannerTest {
    private val p = GesturePlanner(1920, 1080)

    @Test fun mapsNormalizedToPixelsInsideEdges() {
        assertThat(p.toScreen(NormPoint(0.5f, 0.5f)).first).isWithin(1f).of(959.5f)
        assertThat(p.toScreen(NormPoint(0f, 0f))).isEqualTo(1f to 1f)
        assertThat(p.toScreen(NormPoint(2f, -1f))).isEqualTo(1918f to 1f)
    }

    @Test fun swipeDurationIsClamped() {
        val s = p.swipe(listOf(NormPoint(0f, 0f), NormPoint(1f, 1f)), 10)!!
        assertThat(s.durationMillis).isEqualTo(GesturePlanner.MIN_SWIPE_MS)
        assertThat(p.swipe(emptyList(), 100)).isNull()
        assertThat(p.swipe(listOf(NormPoint(0.1f, 0.1f)), 100)!!.durationMillis).isEqualTo(GesturePlanner.TAP_MS)
    }

    @Test fun scrollDragsContentLikeAFinger() {
        // Content up by 200px = finger moves up from the pointer.
        val s = p.scroll(960f to 540f, 0f, 200f)!!
        assertThat(s.points.last().second).isEqualTo(340f)
        assertThat(p.scroll(960f to 540f, 0.2f, 0.3f)).isNull()
    }
}

class CursorTest {
    @Test fun overflowAtEdgesBecomesScroll() {
        val c = CursorModel(1920, 1080)
        val m = c.moveBy(0f, 600f)
        assertThat(c.y).isEqualTo(1079f)
        assertThat(m.overflowY).isWithin(0.01f).of(600f - (1079f - 540f))
    }

    @Test fun dpadAcceleratesAndScalesWithScreen() {
        val c = CursorModel(1920, 1080)
        assertThat(c.dpadStep(0)).isLessThan(c.dpadStep(5))
        assertThat(c.dpadStep(20)).isEqualTo(72f)
        assertThat(CursorModel(3840, 2160).dpadStep(0)).isEqualTo(28f)
    }

    @Test fun touchpadAccelerationKeepsSmallMovesPrecise() {
        assertThat(CursorModel.accelerate(1f)).isWithin(0.1f).of(1.08f)
        assertThat(CursorModel.accelerate(-30f)).isLessThan(-70f)
    }
}

class RemoteMouseTest {
    private val step: (Int) -> Float = { 10f + it }

    @Test fun tvAppsAreNeverIntercepted() {
        val m = RemoteMouse()
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 0, intercepting = false, step).consume).isFalse()
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_UP, true, 0, intercepting = false, step).consume).isFalse()
    }

    @Test fun longOkTogglesPointerInPhoneApps() {
        val m = RemoteMouse(longPressMillis = 700)
        m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 1000, true, step)
        val up = m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, false, 1800, true, step)
        assertThat(up.effects).containsExactly(RemoteMouse.Effect.SetVisible(true))
        assertThat(m.visible).isTrue()
    }

    @Test fun shortOkIsReplayedWhenPointerHidden() {
        val m = RemoteMouse()
        m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 0, true, step)
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, false, 100, true, step).effects).containsExactly(RemoteMouse.Effect.ReplayCenter)
    }

    @Test fun arrowsMoveAndAccelerateWhilePointerShows() {
        val m = RemoteMouse().apply { setVisible(true) }
        val first = m.onKey(KeyEvent.KEYCODE_DPAD_RIGHT, true, 0, false, step).effects.single() as RemoteMouse.Effect.Move
        val second = m.onKey(KeyEvent.KEYCODE_DPAD_RIGHT, true, 50, false, step).effects.single() as RemoteMouse.Effect.Move
        assertThat(first.dx).isEqualTo(10f)
        assertThat(second.dx).isEqualTo(11f)
        assertThat(m.onKey(KeyEvent.KEYCODE_BACK, true, 0, false, step).consume).isFalse()
        m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 100, false, step)
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, false, 150, false, step).effects).containsExactly(RemoteMouse.Effect.Click)
    }
}

class TextEditorTest {
    @Test fun appendAndReplace() {
        assertThat(TextEditor.apply("abc", "d", TextMode.APPEND)).isEqualTo("abcd")
        assertThat(TextEditor.apply("abc", "x", TextMode.REPLACE)).isEqualTo("x")
    }

    @Test fun backspaceRemovesWholeGraphemes() {
        assertThat(TextEditor.backspace("hi👍🏽")).isEqualTo("hi")
        assertThat(TextEditor.backspace("سلام")).isEqualTo("سلا")
        assertThat(TextEditor.backspace("")).isEqualTo("")
    }
}
