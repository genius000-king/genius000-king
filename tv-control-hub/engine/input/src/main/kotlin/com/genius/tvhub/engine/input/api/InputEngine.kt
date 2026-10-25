package com.genius.tvhub.engine.input.api

import com.genius.tvhub.core.model.KeyAction
import com.genius.tvhub.core.model.NormPoint
import com.genius.tvhub.core.model.TextMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/** The input engine's whole surface. Everything else in this module is an implementation detail. */
interface InputEngine {
    /** True while the accessibility service is connected; most input needs it. */
    val ready: StateFlow<Boolean>

    /** A text field on the TV gained (non-null) or lost (null) focus — drives the phone's auto keyboard. */
    val focusedField: Flow<FocusedField?>

    suspend fun key(action: KeyAction): InputResult
    suspend fun tap(at: NormPoint): InputResult
    suspend fun longPress(at: NormPoint): InputResult
    suspend fun swipe(points: List<NormPoint>, durationMillis: Long): InputResult
    suspend fun text(text: String, mode: TextMode): InputResult
    suspend fun edit(action: EditKind): InputResult
    suspend fun cursorMove(dx: Float, dy: Float): InputResult
    suspend fun cursorClick(long: Boolean): InputResult
    suspend fun cursorScroll(dx: Float, dy: Float): InputResult
    suspend fun cursorVisible(visible: Boolean): InputResult

    /** Settings the host passes in; the engine never reads app storage itself. */
    fun configure(prefs: InputPrefs)
}

data class FocusedField(val text: String, val hint: String?, val password: Boolean)

data class InputPrefs(
    val remoteMouseLongPress: Boolean = true,
    val autoMouseForPhoneApps: Boolean = true,
    val launcherTakesHome: Boolean = false,
    /** Component to open when the Home key is taken over. */
    val homeComponent: String? = null,
)

enum class EditKind { BACKSPACE, ENTER, CLEAR }

sealed interface InputResult {
    data object Done : InputResult
    /** The accessibility service is off; [InputEngine.ready] says when it comes back. */
    data object NotReady : InputResult
    data class Unsupported(val why: String) : InputResult
    data class Failed(val why: String) : InputResult
}
