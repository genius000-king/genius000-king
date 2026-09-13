package io.nawah.linux.session

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The display size has now been wrong twice, in opposite directions.
 *
 * First it went nowhere: the wizard's answer was exported into the container as
 * `NAWAH_DISPLAY_WIDTH`, which nothing reads. Then it went somewhere worse — a
 * pixel size in the X server's `custom` mode, which pinned a 16:9 desktop onto
 * a 19.5:9 phone and scaled it up to the panel.
 *
 * A percentage of the panel is right by construction: the aspect ratio cannot
 * be wrong and the screen is always full. These tests hold that.
 */
@RunWith(RobolectricTestRunner::class)
class LorieSettingsTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val settings = LorieSettings(context)

    /** The exact file `PreferenceManager.getDefaultSharedPreferences` uses. */
    private val prefs
        get() = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)

    @Test
    fun `the default fills the screen, at the panel's own resolution`() {
        // The bug this replaced: a pixel size was written into the X server's
        // `custom` mode, pinning the desktop to a 16:9 box on a 19.5:9 phone.
        // Black bars on every side, and the result scaled up to the panel --
        // which is what "it went blurry" was.
        settings.applyScale(100)

        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_MODE, null)).isEqualTo("native")
    }

    @Test
    fun `a lighter display is a percentage, never a pixel size`() {
        settings.applyScale(150)

        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_MODE, null)).isEqualTo("scaled")
        assertThat(prefs.getInt(LorieSettings.KEY_SCALE, 0)).isEqualTo(150)
    }

    @Test
    fun `no fixed resolution is ever written`() {
        // `custom` and `exact` both take a WxH, and a WxH cannot be right on
        // every screen. Neither mode may be reachable from this app again.
        for (percent in listOf(0, 50, 100, 125, 150, 200, 400)) {
            settings.applyScale(percent)
            assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_MODE, null))
                .isAnyOf("native", "scaled")
        }
        assertThat(prefs.contains("displayResolutionCustom")).isFalse()
        assertThat(prefs.contains("displayResolutionExact")).isFalse()
    }

    @Test
    fun `a nonsense percentage falls back to filling the screen`() {
        settings.applyScale(150)
        settings.applyScale(0)

        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_MODE, null)).isEqualTo("native")
    }

    @Test
    fun `keeping the screen on maps to never timing out`() {
        settings.applyKeepScreenOn(true)
        assertThat(prefs.getString(LorieSettings.KEY_SCREEN_IDLE, null)).isEqualTo("never")

        settings.applyKeepScreenOn(false)
        assertThat(prefs.getString(LorieSettings.KEY_SCREEN_IDLE, null)).isEqualTo("system")
    }
}
