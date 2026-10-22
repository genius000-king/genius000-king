package com.tvhub.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.tvhub.design.BrandBackground
import com.tvhub.design.TvHubTheme
import com.tvhub.tv.ui.TvHomeScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // A living-room screen is dark by default. The reference's light theme is left for the settings page.
            TvHubTheme(darkTheme = true) {
                BrandBackground(modifier = Modifier.fillMaxSize()) {
                    TvHomeScreen()
                }
            }
        }
    }
}
