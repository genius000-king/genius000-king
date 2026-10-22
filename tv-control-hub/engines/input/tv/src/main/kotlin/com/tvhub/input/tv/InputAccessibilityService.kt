package com.tvhub.input.tv

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

/**
 * Gives the app the right to perform taps and navigation keys on the TV, without root or ADB.
 * The user enables it once in Settings → Accessibility. It is the only supported input path in the product.
 */
class InputAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }

    companion object {
        /** Set while the user has enabled the service. Null means input is unavailable. */
        @Volatile
        var instance: InputAccessibilityService? = null
    }
}
