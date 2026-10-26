package com.genius.tvhub.engine.input

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.os.SystemClock
import android.view.KeyEvent
import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.TextMode
import com.genius.tvhub.engine.input.api.EditKind
import com.genius.tvhub.engine.input.api.FocusedField
import com.genius.tvhub.engine.input.api.InputEngine
import com.genius.tvhub.engine.input.api.InputPrefs
import com.genius.tvhub.engine.input.api.InputResult
import com.genius.tvhub.engine.input.api.LocalKeys
import com.genius.tvhub.engine.input.api.RawInput
import com.genius.tvhub.engine.input.cursor.CursorModel
import com.genius.tvhub.engine.input.gesture.GesturePlanner
import com.genius.tvhub.engine.input.gesture.Stroke
import com.genius.tvhub.engine.input.keys.KeyRoute
import com.genius.tvhub.engine.input.keys.KeyRouter
import com.genius.tvhub.engine.input.service.HubAccessibilityService
import com.genius.tvhub.engine.input.text.TextEditor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.withContext

/**
 * Input on this TV. Real key/touch events through ADB mode when it is attached and ready;
 * otherwise the accessibility service, plus AudioManager for volume and media.
 */
class AccessibilityInputEngine(context: Context) : InputEngine {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val service get() = HubAccessibilityService.current.value
    private val rawSlot = MutableStateFlow<RawInput?>(null)
    private val raw get() = rawSlot.value?.takeIf { it.ready.value }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    override val ready: StateFlow<Boolean> = combine(
        HubAccessibilityService.current,
        rawSlot.flatMapLatest { it?.ready ?: flowOf(false) },
    ) { s, r -> s != null || r }.stateIn(scope, SharingStarted.Eagerly, service != null)

    override val focusedField: Flow<FocusedField?> = HubAccessibilityService.focusedField

    override fun configure(prefs: InputPrefs) { HubAccessibilityService.prefs.value = prefs }

    override fun attachRawInput(raw: RawInput?) { rawSlot.value = raw }

    override suspend fun key(action: KeyAction): InputResult {
        LocalKeys.sink?.let { sink -> KeyRouter.keyCodeOf(action)?.let { code -> if (deliverLocally(sink, code)) return InputResult.Done } }
        val raw = raw
        return when (val route = KeyRouter.route(action, Build.VERSION.SDK_INT, rawInput = raw != null)) {
            is KeyRoute.Raw -> if (raw?.key(route.keyCode) == true) InputResult.Done else InputResult.Failed("key ${route.keyCode} was not delivered")
            is KeyRoute.Volume -> { audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, route.direction, AudioManager.FLAG_SHOW_UI); InputResult.Done }
            is KeyRoute.Media -> {
                val now = SystemClock.uptimeMillis()
                audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, route.keyCode, 0))
                audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, route.keyCode, 0))
                InputResult.Done
            }
            is KeyRoute.Global -> onMain { s -> if (s.performGlobalAction(route.action)) InputResult.Done else InputResult.Failed("global action ${route.action} refused") }
            is KeyRoute.Focus -> onMain { s ->
                // With the pointer up, arrows move it rather than the (invisible) focus.
                if (s.cursorVisible) { s.moveCursor(focusDx(route.direction) * 40f, focusDy(route.direction) * 40f); InputResult.Done }
                else if (s.moveFocus(route.direction)) InputResult.Done else InputResult.Failed("nothing to move to")
            }
            KeyRoute.FocusClick -> {
                val s = service ?: return InputResult.NotReady
                if (s.cursorVisible) cursorClick(long = false)
                else if (withContext(Dispatchers.Main) { s.clickFocused() }) InputResult.Done else InputResult.Failed("nothing focused to press")
            }
            is KeyRoute.Unsupported -> InputResult.Unsupported(route.why)
        }
    }

    private suspend fun deliverLocally(sink: (KeyEvent) -> Boolean, code: Int): Boolean = withContext(Dispatchers.Main) {
        val now = SystemClock.uptimeMillis()
        sink(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0)).also { sink(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0)) }
    }

    override suspend fun tap(at: NormPoint) = touch(at, longPress = false)
    override suspend fun longPress(at: NormPoint) = touch(at, longPress = true)

    override suspend fun swipe(points: List<NormPoint>, durationMillis: Long): InputResult {
        raw?.let { r -> if (r.swipe(points.map { it.x to it.y }, durationMillis)) return InputResult.Done }
        return gesture { it.planner.swipe(points, durationMillis) }
    }

    private suspend fun touch(at: NormPoint, longPress: Boolean): InputResult {
        raw?.let { r -> if (r.tap(at.x, at.y, longPress)) return InputResult.Done }
        return gesture { if (longPress) it.planner.longPress(at) else it.planner.tap(at) }
    }

    override suspend fun text(text: String, mode: TextMode): InputResult {
        // Real typing first: works in every editor, including the ones accessibility can't set.
        if (mode == TextMode.APPEND) raw?.let { r -> if (r.text(text)) return InputResult.Done }
        return onMain { s ->
            val node = s.focusedEditable() ?: return@onMain InputResult.Unsupported("no text field is focused on the TV")
            val next = TextEditor.apply(currentText(node), text, mode)
            if (s.setText(node, next)) InputResult.Done else InputResult.Failed("the field refused the text")
        }
    }

    override suspend fun edit(action: EditKind): InputResult {
        raw?.let { r ->
            val code = when (action) {
                EditKind.BACKSPACE -> KeyEvent.KEYCODE_DEL
                EditKind.ENTER -> KeyEvent.KEYCODE_ENTER
                EditKind.CLEAR -> null
            }
            if (code != null && r.key(code)) return InputResult.Done
        }
        return onMain { s ->
            val node = s.focusedEditable() ?: return@onMain InputResult.Unsupported("no text field is focused on the TV")
            val ok = when (action) {
                EditKind.BACKSPACE -> s.setText(node, TextEditor.backspace(currentText(node)))
                EditKind.CLEAR -> s.setText(node, "")
                EditKind.ENTER -> s.pressEnter(node)
            }
            if (ok) InputResult.Done else InputResult.Failed("the field refused $action")
        }
    }

    /** An empty field reports its hint as its text; appending to that typed "Search…a". */
    private fun currentText(node: android.view.accessibility.AccessibilityNodeInfo): String =
        if (node.isShowingHintText) "" else node.text?.toString().orEmpty()

    override suspend fun cursorMove(dx: Float, dy: Float) = onMain { s ->
        val k = s.cursor.touchpadScale
        s.moveCursor(CursorModel.accelerate(dx) * k, CursorModel.accelerate(dy) * k); InputResult.Done
    }

    override suspend fun cursorClick(long: Boolean): InputResult {
        val s = service ?: return InputResult.NotReady
        raw?.let { r ->
            val (x, y) = s.cursor.normalized
            if (r.tap(x, y, long)) return InputResult.Done
        }
        val stroke = Stroke(listOf(s.cursor.x to s.cursor.y), if (long) GesturePlanner.LONG_PRESS_MS else GesturePlanner.TAP_MS)
        return if (s.perform(stroke)) InputResult.Done else InputResult.Failed("tap was cancelled")
    }

    override suspend fun cursorScroll(dx: Float, dy: Float) = gesture { it.planner.scroll(it.cursor.x to it.cursor.y, dx, dy) }

    override suspend fun cursorVisible(visible: Boolean) = onMain { s -> s.setCursorVisible(visible); InputResult.Done }

    private suspend fun gesture(plan: (HubAccessibilityService) -> Stroke?): InputResult {
        val s = service ?: return InputResult.NotReady
        val stroke = plan(s) ?: return InputResult.Done
        return if (s.perform(stroke)) InputResult.Done else InputResult.Failed("gesture was cancelled")
    }

    private suspend fun onMain(block: (HubAccessibilityService) -> InputResult): InputResult {
        val s = service ?: return InputResult.NotReady
        return withContext(Dispatchers.Main) { block(s) }
    }

    private fun focusDx(direction: Int) = when (direction) { android.view.View.FOCUS_LEFT -> -1f; android.view.View.FOCUS_RIGHT -> 1f; else -> 0f }
    private fun focusDy(direction: Int) = when (direction) { android.view.View.FOCUS_UP -> -1f; android.view.View.FOCUS_DOWN -> 1f; else -> 0f }
}
