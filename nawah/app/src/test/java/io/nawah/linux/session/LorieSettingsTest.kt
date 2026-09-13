package io.nawah.linux.session

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The resolution the wizard asks for used to go nowhere.
 *
 * It was exported into the container as `NAWAH_DISPLAY_WIDTH`, which nothing
 * reads — the screen size belongs to the X server on this side. These tests pin
 * the contract with the vendored module's preference store, which is the only
 * thing that makes the setting real.
 */
@RunWith(RobolectricTestRunner::class)
class LorieSettingsTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val settings = LorieSettings(context)

    /** The exact file `PreferenceManager.getDefaultSharedPreferences` uses. */
    private val prefs
        get() = context.getSharedPreferences("${context.packageName}_preferences", Context.MODE_PRIVATE)

    @Test
    fun `a resolution is written where the X server reads it`() {
        settings.applyResolution(1920, 1080)

        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_MODE, null)).isEqualTo("custom")
        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_CUSTOM, null)).isEqualTo("1920x1080")
    }

    @Test
    fun `custom is used rather than the fixed list`() {
        // `exact` is a list preference backed by an array inside the vendored
        // module. A size the wizard offers but that array lacks would be
        // dropped without a word.
        settings.applyResolution(2560, 1440)

        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_MODE, null))
            .isEqualTo(LorieSettings.MODE_CUSTOM)
    }

    @Test
    fun `a nonsense resolution is ignored rather than written`() {
        settings.applyResolution(1280, 720)
        settings.applyResolution(0, -5)

        assertThat(prefs.getString(LorieSettings.KEY_RESOLUTION_CUSTOM, null)).isEqualTo("1280x720")
    }

    @Test
    fun `keeping the screen on maps to never timing out`() {
        settings.applyKeepScreenOn(true)
        assertThat(prefs.getString(LorieSettings.KEY_SCREEN_IDLE, null)).isEqualTo("never")

        settings.applyKeepScreenOn(false)
        assertThat(prefs.getString(LorieSettings.KEY_SCREEN_IDLE, null)).isEqualTo("system")
    }
}
