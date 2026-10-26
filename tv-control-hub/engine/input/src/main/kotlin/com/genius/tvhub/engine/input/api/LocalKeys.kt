package com.genius.tvhub.engine.input.api

import android.view.KeyEvent

/**
 * TV Hub's own window, while it is in front. Keys for our own launcher are delivered straight
 * into it as real key events: no accessibility, no ADB, exactly like the physical remote.
 */
object LocalKeys {
    @Volatile var sink: ((KeyEvent) -> Boolean)? = null
}
