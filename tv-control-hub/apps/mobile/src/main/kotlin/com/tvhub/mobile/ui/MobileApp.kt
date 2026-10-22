package com.tvhub.mobile.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tvhub.design.LocalBrandPalette
import com.tvhub.mobile.navigation.MobilePage
import com.tvhub.mobile.navigation.MobileSection

@Composable
fun MobileApp(modifier: Modifier = Modifier) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentSectionRoute = backStackEntry?.destination?.route?.substringBefore('/')
    val palette = LocalBrandPalette.current

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            NavigationBar(containerColor = palette.glassStrong) {
                MobileSection.entries.forEach { section ->
                    NavigationBarItem(
                        selected = currentSectionRoute == section.route,
                        onClick = {
                            navController.navigate(section.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(section.icon, contentDescription = null) },
                        label = { Text(stringResource(section.label)) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = MobileSection.Home.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            MobileSection.entries.forEach { section ->
                composable(section.route) {
                    SectionScreen(
                        section = section,
                        onOpenPage = { page -> navController.navigate(page.fullRoute) },
                    )
                }
            }
            MobilePage.entries.forEach { page ->
                composable(page.fullRoute) {
                    PageScreen(page = page, onBack = { navController.popBackStack() })
                }
            }
        }
    }
}
