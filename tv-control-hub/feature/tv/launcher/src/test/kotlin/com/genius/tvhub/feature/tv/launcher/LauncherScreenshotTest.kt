package com.genius.tvhub.feature.tv.launcher

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import com.genius.tvhub.core.designsystem.Effects
import com.genius.tvhub.core.designsystem.ImlaqTheme
import com.genius.tvhub.core.designsystem.OverlayHost
import com.github.takahirom.roborazzi.captureScreenRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The TV home at 1920×1080 (960×540 dp at xhdpi), as the Xiaomi box draws it. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w960dp-h540dp-land-television-xhdpi")
class LauncherScreenshotTest {
    @get:Rule val compose = createComposeRule()

    /** Stand-in icons: a coloured squircle with a letter (real icons come from PackageManager). */
    private fun icon(letter: String, color: Color): androidx.compose.ui.graphics.ImageBitmap {
        val b = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        val cv = Canvas(b)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color.toArgb() }
        cv.drawRoundRect(RectF(0f, 0f, 128f, 128f), 30f, 30f, p)
        p.color = android.graphics.Color.WHITE; p.textSize = 64f; p.textAlign = Paint.Align.CENTER; p.isFakeBoldText = true
        cv.drawText(letter, 64f, 86f, p)
        return b.asImageBitmap()
    }

    private fun app(pkg: String, label: String, color: Color, tv: Boolean = true) = LauncherApp(pkg, label, icon(label.take(1), color), color, tv)

    private val space = listOf(
        app("yt", "YouTube", Color(0xFFE53935)),
        app("brave", "Brave", Color(0xFFFF6A2B), tv = false),
        app("nf", "Shahid", Color(0xFF16C784)),
        app("spot", "Spotify", Color(0xFF1DB954), tv = false),
        app("vlc", "VLC", Color(0xFFFF8800)),
        app("tg", "Telegram", Color(0xFF2AA3EF), tv = false),
    )
    private val all = space + listOf(
        app("chrome", "Chrome", Color(0xFF4285F4), tv = false), app("kodi", "Kodi", Color(0xFF17B2E7)),
        app("files", "Files", Color(0xFF7E57C2)), app("termux", "Termux", Color(0xFF222222), tv = false),
        app("play", "Play Store", Color(0xFF01875F)), app("disc", "Discord", Color(0xFF5865F2), tv = false),
        app("pv", "Prime Video", Color(0xFF1399FF)), app("wa", "WhatsApp", Color(0xFF25D366), tv = false),
    )
    private val state = LauncherState(
        space = space, all = all,
        phoneName = "Galaxy S24", ramFraction = 0.58f, storageFraction = 0.41f, setupStepsLeft = 1,
    )
    private val actions = object : LauncherActions {
        override fun launch(app: LauncherApp) {}
        override fun toggleSpace(app: LauncherApp) {}
        override fun appInfo(app: LauncherApp) {}
        override fun uninstall(app: LauncherApp) {}
        override fun run(shortcut: HomeShortcut) {}
        override fun addApp(source: AddSource) {}
        override fun openSettings() {}
    }
    // 21:47 local time on a Wednesday.
    private val now = java.util.Calendar.getInstance().apply { set(2026, 9, 28, 21, 47) }.timeInMillis

    private fun shot(name: String, rtl: Boolean, drawer: Boolean = false, dark: Boolean = true, focusMoves: Int = 0) {
        if (rtl) { RuntimeEnvironment.setQualifiers("+ar"); java.util.Locale.setDefault(java.util.Locale("ar")) } else java.util.Locale.setDefault(java.util.Locale.US)
        compose.setContent {
            // A TV has no touch: put Compose in key mode so focus (and the glow) behaves as on the box.
            val inputMode = androidx.compose.ui.platform.LocalInputModeManager.current
            androidx.compose.runtime.LaunchedEffect(Unit) { inputMode.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard) }
            ImlaqTheme(dark = dark, rtl = rtl, effects = Effects.LITE) {
                OverlayHost { LauncherScreen(state, actions, now, initialDrawer = drawer) }
            }
        }
        compose.mainClock.advanceTimeBy(300)
        if (focusMoves > 0) repeat(focusMoves) {
            compose.onRoot().performKeyInput { pressKey(androidx.compose.ui.input.key.Key.DirectionRight) }
            compose.mainClock.advanceTimeBy(200)
        }
        compose.mainClock.advanceTimeBy(1500)
        compose.waitForIdle()
        captureScreenRoboImage("build/outputs/roborazzi/tv_$name.png")
    }

    @Test fun homeArabic() = shot("home_ar", rtl = true)
    @Test fun homeEnglish() = shot("home_en", rtl = false)
    @Test fun homeFocusMoved() = shot("home_focus_en", rtl = false, focusMoves = 1)
    @Test fun drawerArabic() = shot("drawer_ar", rtl = true, drawer = true)
}
