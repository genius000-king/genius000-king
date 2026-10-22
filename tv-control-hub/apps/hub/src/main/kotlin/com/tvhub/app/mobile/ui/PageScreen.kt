package com.tvhub.app.mobile.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.tvhub.design.LocalBrandPalette
import com.tvhub.app.R
import com.tvhub.app.mobile.navigation.MobilePage

/** A single function page. Its own top bar keeps it separate from the other pages. */
@Composable
fun PageScreen(
    page: MobilePage,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = LocalBrandPalette.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = stringResource(R.string.action_back),
                tint = palette.content,
                modifier = Modifier
                    .clickable(onClick = onBack)
                    .padding(8.dp),
            )
            Text(
                text = stringResource(page.label),
                style = MaterialTheme.typography.titleLarge,
                color = palette.content,
            )
        }

        Spacer(Modifier.height(32.dp))

        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.phase_pending, "P${page.plannedPhase}"),
                style = MaterialTheme.typography.bodyLarge,
                color = palette.contentSecondary,
            )
        }
    }
}
