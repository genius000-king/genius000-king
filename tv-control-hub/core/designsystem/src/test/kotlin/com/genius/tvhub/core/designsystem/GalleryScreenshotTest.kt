package com.genius.tvhub.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Renders the component family so a change to a token shows up as a picture, not a guess. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w400dp-h900dp-xxhdpi")
class GalleryScreenshotTest {
    @get:Rule val compose = createComposeRule()

    private fun gallery(dark: Boolean, rtl: Boolean, name: String) {
        compose.setContent {
            ImlaqTheme(dark = dark, rtl = rtl) {
                HubPage(title = if (rtl) "مواد الهوية" else "Materials", onBack = {}) {
                    GlassCard {
                        Text(if (rtl) "بطاقة زجاجية" else "Glass card", style = MaterialTheme.typography.titleMedium, color = Imlaq.colors.text)
                        Text(if (rtl) "نص ثانوي بنسبة 62%" else "Secondary text at 62%", style = MaterialTheme.typography.bodyMedium, color = Imlaq.colors.muted)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PillButton(if (rtl) "إجراء أساسي" else "Primary", {})
                        GhostButton(if (rtl) "ثانوي" else "Secondary", {})
                    }
                                        GlassCard(padding = androidx.compose.foundation.layout.PaddingValues(4.dp)) {
                        ToggleRow(if (rtl) "الماوس من الريموت" else "Remote mouse", true, {}, subtitle = if (rtl) "ضغطة مطوّلة على OK" else "Long-press OK")
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        MetricTile(HubIcons.Memory, "RAM", "1.2 GB", Modifier.weight(1f), fraction = 0.62f, caption = "of 2 GB")
                        MetricTile(HubIcons.Cpu, "CPU", null, Modifier.weight(1f), unavailable = if (rtl) "محجوب منذ Android 8" else "Blocked since Android 8")
                    }
                    Sparkline(listOf(3f, 5f, 4f, 8f, 6f, 9f, 7f, 10f))
                    StatusDot(if (rtl) "متصل" else "Connected", Imlaq.colors.ok)
                    Row(Modifier.fillMaxWidth().padding(4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        listOf(HubIcons.Home, HubIcons.Remote, HubIcons.Cpu, HubIcons.Folder, HubIcons.Terminal, HubIcons.Server, HubIcons.Shield, HubIcons.Wifi, HubIcons.Beam, HubIcons.Mouse).forEach {
                            Icon(it, null, tint = Imlaq.colors.text, modifier = Modifier.padding(2.dp))
                        }
                    }
                }
            }
        }
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/gallery_$name.png")
    }

    @Test fun darkArabic() = gallery(dark = true, rtl = true, name = "dark_ar")
    @Test fun lightEnglish() = gallery(dark = false, rtl = false, name = "light_en")
}
