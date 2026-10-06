package com.genius.imlaq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.imlaq.designsystem.DarkColors
import com.genius.imlaq.designsystem.ImlaqTheme
import com.genius.imlaq.designsystem.LightColors
import com.genius.imlaq.ui.AppRoot

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
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

    private fun applySystemBars(dark: Boolean) {
        val bg = (if (dark) DarkColors else LightColors).background.toArgb()
        val style = if (dark) SystemBarStyle.dark(bg) else SystemBarStyle.light(bg, bg)
        enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }
}
