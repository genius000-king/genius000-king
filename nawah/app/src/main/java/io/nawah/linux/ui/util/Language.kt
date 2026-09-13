package io.nawah.linux.ui.util

import android.content.Context

/**
 * The language the app is currently showing, as an ISO 639 code.
 *
 * Read from the configuration rather than from the user's stored preference,
 * because those differ: the preference may be "follow the system", and what the
 * catalog needs to know is which language actually ended up on screen.
 */
fun Context.currentLanguage(): String =
    resources.configuration.locales.takeIf { !it.isEmpty }?.get(0)?.language ?: "en"
