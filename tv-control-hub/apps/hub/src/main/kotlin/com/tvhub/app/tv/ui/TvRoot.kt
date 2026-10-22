package com.tvhub.app.tv.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue

/** Root of the TV interface: the home screen, and the P1 lab on top of it. */
@Composable
fun TvRoot() {
    var showLab by rememberSaveable { mutableStateOf(false) }
    if (showLab) {
        LabScreen(onBack = { showLab = false })
    } else {
        TvHomeScreen(onOpenLab = { showLab = true })
    }
}
