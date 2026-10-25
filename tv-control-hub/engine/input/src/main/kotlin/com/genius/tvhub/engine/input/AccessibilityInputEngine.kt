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
import com.genius.tvhub.engine.input.cursor.CursorModel
import com.genius.tvhub.engine.input.keys.KeyRoute
import com.genius.tvhub.engine.input.keys.KeyRouter
import com.genius.tvhub.engine.input.service.HubAccessibilityService
import com.genius.tvhub.engine.input.text.TextEditor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.withContext

/** Input on this TV through the accessibility service, plus AudioManager for volume and media. */
class AccessibilityInputEngine(context: Context) : InputEngine {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val service get() = HubAccessibilityService.current.value

    override val ready: StateFlow<Boolean> =
        HubAccessibilityService.current.map { it != null }.stateIn(scope, SharingStarted.Eagerly, service != null)

    override val focusedField: Flow<FocusedField?> = HubAccessibilityService.focusedField

    override fun configure(prefs: InputPrefs) { HubAccessibilityService.prefs.value = prefs }

    override suspend fun key(action: KeyAction): InputResult = when (val route = KeyRouter.route(action, Build.VERSION.SDK_INT)) {
        is KeyRoute.Volume -> { audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, route.direction, AudioManager.FLAG_SHOW_UI); InputResult.Done }
        is KeyRoute.Media -> {
            val now = SystemClock.uptimeMillis()
            audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, route.keyCode, 0))
            audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, route.keyCode, 0))
            InputResult.Done
        }
        is KeyRoute.Global -> onMain { s -> if (s.performGlobalAction(route.action)) InputResult.Done else InputResult.Failed("global action ${route.action} refused") }
        is KeyRoute.Unsupported -> InputResult.Unsupported(route.why)
    }

    override suspend fun tap(at: NormPoint) = gesture { it.planner.tap(at) }
    override suspend fun longPress(at: NormPoint) = gesture { it.planner.longPress(at) }
    override suspend fun swipe(points: List<NormPoint>, durationMillis: Long) = gesture { it.planner.swipe(points, durationMillis) }

    override suspend fun text(text: String, mode: TextMode): InputResult = onMain { s ->
        val node = s.focusedEditable() ?: return@onMain InputResult.Unsupported("no text field is focused on the TV")
        val next = TextEditor.apply(node.text?.toString().orEmpty(), text, mode)
        if (s.setText(node, next)) InputResult.Done else InputResult.Failed("the field refused the text")
    }

    override suspend fun edit(action: EditKind): InputResult = onMain { s ->
        val node = s.focusedEditable() ?: return@onMain InputResult.Unsupported("no text field is focused on the TV")
        val ok = when (action) {
            EditKind.BACKSPACE -> s.setText(node, TextEditor.backspace(node.text?.toString().orEmpty()))
            EditKind.CLEAR -> s.setText(node, "")
            EditKind.ENTER -> s.pressEnter(node)
        }
        if (ok) InputResult.Done else InputResult.Failed("the field refused $action")
    }

    override suspend fun cursorMove(dx: Float, dy: Float) = onMain { s ->
        s.moveCursor(CursorModel.accelerate(dx), CursorModel.accelerate(dy)); InputResult.Done
    }

    override suspend fun cursorClick(long: Boolean): InputResult {
        val s = service ?: return InputResult.NotReady
        val at = s.cursor.x to s.cursor.y
        val stroke = com.genius.tvhub.engine.input.gesture.Stroke(listOf(at), if (long) 650 else 40)
        return if (s.perform(stroke)) InputResult.Done else InputResult.Failed("tap was cancelled")
    }

    override suspend fun cursorScroll(dx: Float, dy: Float) = gesture { it.planner.scroll(it.cursor.x to it.cursor.y, dx, dy) }

    override suspend fun cursorVisible(visible: Boolean) = onMain { s -> s.setCursorVisible(visible); InputResult.Done }

    private suspend fun gesture(plan: (HubAccessibilityService) -> com.genius.tvhub.engine.input.gesture.Stroke?): InputResult {
        val s = service ?: return InputResult.NotReady
        val stroke = plan(s) ?: return InputResult.Done
        return if (s.perform(stroke)) InputResult.Done else InputResult.Failed("gesture was cancelled")
    }

    private suspend fun onMain(block: (HubAccessibilityService) -> InputResult): InputResult {
        val s = service ?: return InputResult.NotReady
        return withContext(Dispatchers.Main) { block(s) }
    }
}
