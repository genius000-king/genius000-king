package com.genius.saraat

import android.Manifest
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.genius.saraat.data.Prefs
import com.genius.saraat.ui.Palette
import com.genius.saraat.ui.AppsScreen
import com.genius.saraat.ui.HomeScreen
import com.genius.saraat.ui.Ico
import com.genius.saraat.ui.SaratTheme
import com.genius.saraat.ui.SettingsScreen
import com.genius.saraat.ui.UsageScreen
import com.genius.saraat.vpn.SaratService

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent { SaratTheme { Root() } }
    }

    override fun onStart() {
        super.onStart()
        // Opening the app is a good moment to make sure monitoring is alive.
        if (Prefs.current.keepLogging) SaratService.apply(this)
    }
}

@Composable
private fun Root() {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var showApps by rememberSaveable { mutableStateOf(false) }

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    BackHandler(showApps) { showApps = false }

    Scaffold(
        containerColor = androidx.compose.ui.graphics.Color.White,
        bottomBar = {
            Column {
                HorizontalDivider(color = Palette.Outline)
                NavigationBar(containerColor = androidx.compose.ui.graphics.Color.White, tonalElevation = androidx.compose.ui.unit.Dp(0f)) {
                    val items = listOf(
                        Triple("الرئيسية", R.drawable.ic_gauge, 0),
                        Triple("السجل", R.drawable.ic_bars, 1),
                        Triple("الإعدادات", R.drawable.ic_sliders, 2),
                    )
                    items.forEach { (label, icon, index) ->
                        NavigationBarItem(
                            selected = tab == index && !showApps,
                            onClick = { tab = index; showApps = false },
                            icon = { Ico(icon, tint = if (tab == index && !showApps) Palette.Blue else Palette.Muted) },
                            label = { Text(label, style = androidx.compose.material3.MaterialTheme.typography.labelMedium) },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = Palette.BlueSoft,
                                selectedTextColor = Palette.Blue,
                                unselectedTextColor = Palette.Muted,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).statusBarsPadding()) {
            when {
                showApps -> AppsScreen(onBack = { showApps = false })
                tab == 0 -> HomeScreen(onOpenApps = { showApps = true })
                tab == 1 -> UsageScreen()
                else -> SettingsScreen()
            }
        }
    }
}
