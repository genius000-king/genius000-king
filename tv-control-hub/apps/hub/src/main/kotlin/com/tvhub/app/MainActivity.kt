package com.tvhub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.tvhub.app.mobile.ui.MobileApp
import com.tvhub.app.tv.ui.TvRoot
import com.tvhub.design.BrandBackground
import com.tvhub.design.TvHubTheme

/** The only activity. [DeviceKind] picks the phone or the TV interface at launch. */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val device = DeviceKind.detect(this)
        if (device == DeviceKind.Phone) enableEdgeToEdge()

        setContent {
            when (device) {
                // A living-room screen is dark by default. The phone follows the system theme.
                DeviceKind.Tv -> TvHubTheme(darkTheme = true) {
                    BrandBackground(modifier = Modifier.fillMaxSize()) { TvRoot() }
                }
                DeviceKind.Phone -> TvHubTheme {
                    BrandBackground(modifier = Modifier.fillMaxSize()) { MobileApp() }
                }
            }
        }
    }
}
