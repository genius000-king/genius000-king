package com.tvhub.tv.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Button
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text as TvText
import com.tvhub.design.LocalBrandPalette
import com.tvhub.tv.R
import com.tvhub.tv.navigation.TvScreen

/**
 * Home of the TV app: connection status placeholder and the list of the six screens.
 * Focus moves with the D-pad, and every item is a large target readable from the sofa.
 */
@Composable
fun TvHomeScreen(
    onOpenLab: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val palette = LocalBrandPalette.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 72.dp, vertical = 48.dp),
    ) {
        Text(
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.displaySmall,
            color = palette.content,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.tv_home_subtitle),
            style = MaterialTheme.typography.titleMedium,
            color = palette.contentSecondary,
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onOpenLab) {
            TvText(text = stringResource(R.string.lab_open))
        }
        Spacer(Modifier.height(24.dp))

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            items(TvScreen.entries, key = { it.route }) { screen ->
                TvScreenItem(screen = screen, onClick = { /* screens arrive in phase P2 */ })
            }
        }
    }
}

@Composable
private fun TvScreenItem(screen: TvScreen, onClick: () -> Unit) {
    val palette = LocalBrandPalette.current
    val shape = RoundedCornerShape(16.dp)

    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = palette.glassStrong,
            contentColor = palette.content,
            focusedContainerColor = palette.content,
            focusedContentColor = palette.background,
        ),
        border = ClickableSurfaceDefaults.border(
            border = Border(border = BorderStroke(1.dp, palette.border), shape = shape),
            focusedBorder = Border(border = BorderStroke(2.dp, palette.content), shape = shape),
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.03f),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvText(
                text = stringResource(screen.label),
                style = androidx.tv.material3.MaterialTheme.typography.titleLarge,
            )
            TvText(
                text = "P${screen.plannedPhase}",
                style = androidx.tv.material3.MaterialTheme.typography.labelLarge,
            )
        }
    }
}
