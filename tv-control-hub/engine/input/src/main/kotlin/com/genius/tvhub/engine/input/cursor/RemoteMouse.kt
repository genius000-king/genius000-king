package com.genius.tvhub.engine.input.cursor

import android.view.KeyEvent

/**
 * The physical remote as a mouse, decided per key event. Pure state machine; the accessibility
 * service feeds it key events and carries out what it returns.
 *
 * - Off by default in TV apps: their own OK and long-press keep working untouched.
 * - In phone apps (and our launcher) a long press on OK toggles the pointer.
 * - While the pointer shows: arrows move it (accelerating), OK clicks, Back passes through.
 */
class RemoteMouse(private val longPressMillis: Long = 700) {

    sealed interface Effect {
        data class Move(val dx: Float, val dy: Float) : Effect
        data object Click : Effect
        data class SetVisible(val visible: Boolean) : Effect
        /** We swallowed an OK press that turned out short: replay it as a D-pad center. */
        data object ReplayCenter : Effect
    }

    data class Decision(val consume: Boolean, val effects: List<Effect> = emptyList())

    var visible = false
        private set
    private var centerDownAt = -1L
    private var lastDirection = -1
    private var repeat = 0

    fun setVisible(v: Boolean) { visible = v; repeat = 0 }

    /**
     * @param intercepting whether long-press toggling applies now (setting on and the foreground
     *   app is a phone app or our launcher).
     * @param step pixel step for the n-th repeat, from [CursorModel.dpadStep].
     */
    fun onKey(keyCode: Int, down: Boolean, timeMillis: Long, intercepting: Boolean, step: (Int) -> Float): Decision {
        val isCenter = keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
        if (isCenter && (visible || intercepting)) return center(down, timeMillis)
        if (!visible) return PASS
        val dir = DIRECTIONS[keyCode] ?: return PASS
        if (!down) return Decision(true)
        repeat = if (dir == lastDirection) repeat + 1 else 0
        lastDirection = dir
        val s = step(repeat)
        val (dx, dy) = when (dir) { 0 -> 0f to -s; 1 -> 0f to s; 2 -> -s to 0f; else -> s to 0f }
        return Decision(true, listOf(Effect.Move(dx, dy)))
    }

    private fun center(down: Boolean, time: Long): Decision {
        if (down) {
            if (centerDownAt < 0) centerDownAt = time
            return Decision(true)
        }
        val held = if (centerDownAt >= 0) time - centerDownAt else 0
        centerDownAt = -1
        return when {
            held >= longPressMillis -> { setVisible(!visible); Decision(true, listOf(Effect.SetVisible(visible))) }
            visible -> Decision(true, listOf(Effect.Click))
            else -> Decision(true, listOf(Effect.ReplayCenter))
        }
    }

    private companion object {
        val PASS = Decision(false)
        val DIRECTIONS = mapOf(
            KeyEvent.KEYCODE_DPAD_UP to 0, KeyEvent.KEYCODE_DPAD_DOWN to 1,
            KeyEvent.KEYCODE_DPAD_LEFT to 2, KeyEvent.KEYCODE_DPAD_RIGHT to 3,
        )
    }
}
