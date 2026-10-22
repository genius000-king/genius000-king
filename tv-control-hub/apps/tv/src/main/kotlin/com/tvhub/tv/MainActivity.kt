package com.tvhub.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.tvhub.design.BrandBackground
import com.tvhub.design.TvHubTheme
import com.tvhub.tv.ui.LabScreen
import com.tvhub.tv.ui.TvHomeScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // A living-room screen is dark by default. The reference's light theme is left for the settings page.
            TvHubTheme(darkTheme = true) {
                BrandBackground(modifier = Modifier.fillMaxSize()) {
                    var showLab by rememberSaveable { mutableStateOf(false) }
                    if (showLab) {
                        LabScreen(onBack = { showLab = false })
                    } else {
                        TvHomeScreen(onOpenLab = { showLab = true })
                    }
                }
            }
        }
    }
}
