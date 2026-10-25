package com.genius.tvhub.engine.input.text

import com.genius.tvhub.core.model.TextMode

/** What the focused field should contain after a phone keyboard action. Pure. */
object TextEditor {
    fun apply(current: String, incoming: String, mode: TextMode): String = when (mode) {
        TextMode.REPLACE -> incoming
        TextMode.APPEND -> current + incoming
    }

    /** Remove one user-perceived character, not one UTF-16 unit (emoji, Arabic with diacritics). */
    fun backspace(current: String): String {
        if (current.isEmpty()) return current
        val it = java.text.BreakIterator.getCharacterInstance()
        it.setText(current)
        val end = it.last()
        val start = it.previous()
        return current.removeRange(start, end)
    }
}
