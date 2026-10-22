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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.tvhub.design.GlassSurface
import com.tvhub.design.LocalBrandPalette
import com.tvhub.app.R
import com.tvhub.app.mobile.navigation.MobilePage
import com.tvhub.app.mobile.navigation.MobileSection

private val ScreenGutter = 16.dp

/** Root screen of a section: a list of page cards, or an overview when the section has no pages. */
@Composable
fun SectionScreen(
    section: MobileSection,
    onOpenPage: (MobilePage) -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = LocalBrandPalette.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = ScreenGutter, vertical = 24.dp),
    ) {
        Text(
            text = stringResource(section.label),
            style = MaterialTheme.typography.headlineMedium,
            color = palette.content,
        )
        Spacer(Modifier.height(16.dp))

        if (section.pages.isEmpty()) {
            Text(
                text = stringResource(R.string.home_overview_placeholder),
                style = MaterialTheme.typography.bodyLarge,
                color = palette.contentSecondary,
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(section.pages, key = { it.route }) { page ->
                    PageCard(page = page, onClick = { onOpenPage(page) })
                }
            }
        }
    }
}

@Composable
private fun PageCard(page: MobilePage, onClick: () -> Unit) {
    val palette = LocalBrandPalette.current
    GlassSurface(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(page.label),
                style = MaterialTheme.typography.titleMedium,
                color = palette.content,
            )
            Text(
                text = "P${page.plannedPhase}",
                style = MaterialTheme.typography.labelMedium,
                color = palette.contentTertiary,
            )
        }
    }
}
