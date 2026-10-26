package com.genius.tvhub.engine.input.cursor

import android.view.KeyEvent

/**
 * The physical remote as a mouse, decided per key event. Pure state machine; the accessibility
 * service feeds it key events and carries out what it returns.
 *
 * - TV apps are never touched: their keys pass straight through.
 * - In phone apps, a long press on BACK shows or hides the pointer. BACK is used because it can
 *   be replayed on every Android version (a global action), so a short press still goes back.
 * - While the pointer shows: arrows move it (accelerating), OK clicks.
 */
class RemoteMouse(private val longPressMillis: Long = 650) {

    sealed interface Effect {
        data class Move(val dx: Float, val dy: Float) : Effect
        data object Click : Effect
        data class SetVisible(val visible: Boolean) : Effect
        /** We held a BACK press to measure it; it was short, so perform the normal back. */
        data object ReplayBack : Effect
    }

    data class Decision(val consume: Boolean, val effects: List<Effect> = emptyList())

    var visible = false
        private set
    private var backDownAt = -1L
    private var lastDirection = -1
    private var repeat = 0

    fun setVisible(v: Boolean) { visible = v; repeat = 0 }

    /**
     * @param intercepting long-press toggling applies now (setting on, a phone app in front).
     * @param step pixel step for the n-th repeat, from [CursorModel.dpadStep].
     */
    fun onKey(keyCode: Int, down: Boolean, timeMillis: Long, intercepting: Boolean, step: (Int) -> Float): Decision {
        if (keyCode == KeyEvent.KEYCODE_BACK && (intercepting || visible)) return back(down, timeMillis)
        if (!visible) return PASS
        val isCenter = keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
        if (isCenter) return if (down) Decision(true) else Decision(true, listOf(Effect.Click))
        val dir = DIRECTIONS[keyCode] ?: return PASS
        if (!down) return Decision(true)
        repeat = if (dir == lastDirection) repeat + 1 else 0
        lastDirection = dir
        val s = step(repeat)
        val (dx, dy) = when (dir) { 0 -> 0f to -s; 1 -> 0f to s; 2 -> -s to 0f; else -> s to 0f }
        return Decision(true, listOf(Effect.Move(dx, dy)))
    }

    private fun back(down: Boolean, time: Long): Decision {
        if (down) {
            if (backDownAt < 0) backDownAt = time
            return Decision(true)
        }
        val held = if (backDownAt >= 0) time - backDownAt else 0
        backDownAt = -1
        return if (held >= longPressMillis) {
            setVisible(!visible)
            Decision(true, listOf(Effect.SetVisible(visible)))
        } else {
            Decision(true, listOf(Effect.ReplayBack))
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
