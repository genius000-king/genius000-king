package com.genius.tvhub.engine.input

import android.accessibilityservice.AccessibilityService
import android.media.AudioManager
import android.view.KeyEvent
import android.view.View
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.engine.input.cursor.CursorModel
import com.genius.tvhub.engine.input.cursor.RemoteMouse
import com.genius.tvhub.engine.input.gesture.GesturePlanner
import com.genius.tvhub.engine.input.keys.Box
import com.genius.tvhub.engine.input.keys.KeyRoute
import com.genius.tvhub.engine.input.keys.KeyRouter
import com.genius.tvhub.engine.input.keys.SpatialNavigator
import com.genius.tvhub.engine.input.text.TextEditor
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class KeyRouterTest {
    @Test fun everyActionHasARoute() {
        listOf(29, 31, 34).forEach { sdk ->
            listOf(true, false).forEach { raw ->
                KeyAction.entries.forEach { assertThat(KeyRouter.route(it, sdk, raw)).isNotInstanceOf(KeyRoute.Unsupported::class.java) }
            }
        }
    }

    @Test fun android12MovesFocusThroughAccessibility() {
        assertThat(KeyRouter.route(KeyAction.UP, 31, false)).isEqualTo(KeyRoute.Focus(View.FOCUS_UP))
        assertThat(KeyRouter.route(KeyAction.CENTER, 31, false)).isEqualTo(KeyRoute.FocusClick)
        assertThat(KeyRouter.route(KeyAction.UP, 34, false)).isEqualTo(KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_DPAD_UP))
        assertThat(KeyRouter.route(KeyAction.BACK, 29, false)).isEqualTo(KeyRoute.Global(AccessibilityService.GLOBAL_ACTION_BACK))
    }

    @Test fun adbModeSendsRealKeysButKeepsVolumeOnAudio() {
        assertThat(KeyRouter.route(KeyAction.UP, 31, true)).isEqualTo(KeyRoute.Raw(KeyEvent.KEYCODE_DPAD_UP))
        assertThat(KeyRouter.route(KeyAction.CENTER, 31, true)).isEqualTo(KeyRoute.Raw(KeyEvent.KEYCODE_DPAD_CENTER))
        assertThat(KeyRouter.route(KeyAction.VOLUME_UP, 31, true)).isEqualTo(KeyRoute.Volume(AudioManager.ADJUST_RAISE))
    }

    @Test fun volumeAndMediaNeedNoAccessibility() {
        val vol = KeyRouter.route(KeyAction.VOLUME_UP, 34, false)
        assertThat(vol).isEqualTo(KeyRoute.Volume(AudioManager.ADJUST_RAISE))
        assertThat(KeyRouter.needsAccessibility(vol)).isFalse()
        assertThat(KeyRouter.needsAccessibility(KeyRoute.Focus(View.FOCUS_UP))).isTrue()
        assertThat(KeyRouter.route(KeyAction.PLAY_PAUSE, 34, false)).isEqualTo(KeyRoute.Media(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
    }
}

class SpatialNavigatorTest {
    // A launcher-like grid: row of three, and a wide button below the middle one.
    private val a = Box(0, 0, 100, 100)
    private val b = Box(120, 0, 220, 100)
    private val c = Box(240, 0, 340, 100)
    private val wide = Box(100, 140, 260, 200)
    private val all = listOf(a, b, c, wide)

    @Test fun movesAlongTheRow() {
        assertThat(SpatialNavigator.next(b, all, View.FOCUS_RIGHT)).isEqualTo(2)
        assertThat(SpatialNavigator.next(b, all, View.FOCUS_LEFT)).isEqualTo(0)
    }

    @Test fun prefersTheElementInTheSameColumn() {
        assertThat(SpatialNavigator.next(wide, all, View.FOCUS_UP)).isEqualTo(1)
        assertThat(SpatialNavigator.next(a, all, View.FOCUS_DOWN)).isEqualTo(3)
    }

    @Test fun nothingBeyondTheEdge() {
        assertThat(SpatialNavigator.next(c, all, View.FOCUS_RIGHT)).isNull()
        assertThat(SpatialNavigator.next(a, all, View.FOCUS_UP)).isNull()
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
        assertThat(CursorModel.accelerate(1f)).isWithin(0.05f).of(1.02f)
        assertThat(CursorModel.accelerate(-30f)).isWithin(0.5f).of(-48f) // capped at ×1.6
    }
}

class RemoteMouseTest {
    private val step: (Int) -> Float = { 10f + it }

    @Test fun tvAppsAreNeverIntercepted() {
        val m = RemoteMouse()
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 0, intercepting = false, step).consume).isFalse()
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_UP, true, 0, intercepting = false, step).consume).isFalse()
        assertThat(m.onKey(KeyEvent.KEYCODE_BACK, true, 0, intercepting = false, step).consume).isFalse()
    }

    @Test fun longBackTogglesPointerInPhoneApps() {
        val m = RemoteMouse(longPressMillis = 700)
        m.onKey(KeyEvent.KEYCODE_BACK, true, 1000, true, step)
        m.onKey(KeyEvent.KEYCODE_BACK, true, 1400, true, step) // key repeat while held
        val up = m.onKey(KeyEvent.KEYCODE_BACK, false, 1800, true, step)
        assertThat(up.effects).containsExactly(RemoteMouse.Effect.SetVisible(true))
        assertThat(m.visible).isTrue()
        // OK now clicks instead of passing through.
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 1900, true, step).consume).isTrue()
    }

    @Test fun shortBackStillGoesBack() {
        val m = RemoteMouse()
        m.onKey(KeyEvent.KEYCODE_BACK, true, 0, true, step)
        assertThat(m.onKey(KeyEvent.KEYCODE_BACK, false, 100, true, step).effects).containsExactly(RemoteMouse.Effect.ReplayBack)
        assertThat(m.visible).isFalse()
    }

    @Test fun okPassesThroughWhilePointerHidden() {
        val m = RemoteMouse()
        assertThat(m.onKey(KeyEvent.KEYCODE_DPAD_CENTER, true, 0, true, step).consume).isFalse()
    }

    @Test fun arrowsMoveAndAccelerateWhilePointerShows() {
        val m = RemoteMouse().apply { setVisible(true) }
        val first = m.onKey(KeyEvent.KEYCODE_DPAD_RIGHT, true, 0, false, step).effects.single() as RemoteMouse.Effect.Move
        val second = m.onKey(KeyEvent.KEYCODE_DPAD_RIGHT, true, 50, false, step).effects.single() as RemoteMouse.Effect.Move
        assertThat(first.dx).isEqualTo(10f)
        assertThat(second.dx).isEqualTo(11f)
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
