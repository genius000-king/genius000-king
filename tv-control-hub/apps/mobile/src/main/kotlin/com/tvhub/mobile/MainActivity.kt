package com.tvhub.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.tvhub.design.BrandBackground
import com.tvhub.design.TvHubTheme
import com.tvhub.mobile.ui.MobileApp

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TvHubTheme {
                BrandBackground(modifier = Modifier.fillMaxSize()) {
                    MobileApp()
                }
            }
        }
    }
}
