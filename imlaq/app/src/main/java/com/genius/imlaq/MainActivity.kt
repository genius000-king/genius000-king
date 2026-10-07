package com.genius.imlaq

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.imlaq.designsystem.ImlaqTheme
import com.genius.imlaq.ui.AppRoot

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Edge to edge from the very first frame, before Compose has run.
        applySystemBars(dark = (application as ImlaqApp).container.settings.darkTheme.value)
        super.onCreate(savedInstanceState)
        val container = (application as ImlaqApp).container

        setContent {
            val dark by container.settings.darkTheme.collectAsStateWithLifecycle()
            LaunchedEffect(dark) { applySystemBars(dark) }
            ImlaqTheme(dark = dark) {
                AppRoot(container, dark, onToggleTheme = { container.settings.setDarkTheme(!dark) })
            }
        }
    }

    /**
     * Fully transparent system bars: the stone backdrop runs under the clock, the battery and the
     * gesture bar. (An opaque scrim here painted a flat band over the top of the app.) Only the
     * icon colour changes with the theme: light icons on the dark theme, dark on the light one.
     */
    private fun applySystemBars(dark: Boolean) {
        val clear = Color.TRANSPARENT
        val style = if (dark) SystemBarStyle.dark(clear) else SystemBarStyle.light(clear, clear)
        enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
        if (Build.VERSION.SDK_INT >= 29) {
            // No grey contrast scrim behind the 3-button / gesture navigation bar either.
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }
    }
}
