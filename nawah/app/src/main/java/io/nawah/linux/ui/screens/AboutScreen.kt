package io.nawah.linux.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing

/**
 * What the app is, what it cannot do, who wrote it, and whose code it ships.
 *
 * The third section is not modesty and the fourth is not decoration: proot and
 * busybox are GPL-2.0 and the X server is GPL-3.0, so naming them and stating
 * the licence is a condition of shipping them at all. An app that hides its
 * attributions in a repository file nobody opens has not met it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AboutScreen(
    versionName: String,
    sourceUrl: String,
    onBack: () -> Unit,
    onOpenUrl: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.about_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.md)
                .padding(bottom = Spacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(Spacing.lg))
            Image(
                painter = painterResource(R.mipmap.ic_launcher),
                contentDescription = null,
                modifier = Modifier.size(88.dp),
            )
            Spacer(Modifier.height(Spacing.sm))
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineSmall)
            Text(
                stringResource(R.string.about_version) + " " + versionName,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(Spacing.lg))

            Section(stringResource(R.string.about_what_title), stringResource(R.string.about_what_body))
            Section(stringResource(R.string.about_honest_title), stringResource(R.string.about_honest_body))
            Section(stringResource(R.string.about_author_title), stringResource(R.string.about_author_body))

            Section(
                stringResource(R.string.about_credits_title),
                stringResource(R.string.about_credits_body),
            ) {
                Spacer(Modifier.height(Spacing.sm))
                Credit(stringResource(R.string.about_credit_proot))
                Credit(stringResource(R.string.about_credit_termux_x11))
                Credit(stringResource(R.string.about_credit_busybox))
            }

            Section(
                stringResource(R.string.about_licence_title),
                stringResource(R.string.about_licence_body),
            )

            Spacer(Modifier.height(Spacing.lg))
            OutlinedButton(
                onClick = { onOpenUrl(sourceUrl) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.about_source))
            }
            Spacer(Modifier.height(Spacing.sm))
            OutlinedButton(
                onClick = { onOpenUrl("$sourceUrl/issues") },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.about_report))
            }
        }
    }
}

@Composable
private fun Section(
    title: String,
    body: String,
    extra: @Composable ColumnScope.() -> Unit = {},
) {
    Column(Modifier.fillMaxWidth().padding(top = Spacing.lg)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(Spacing.xs))
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        extra()
    }
}

@Composable
private fun Credit(text: String) {
    Row(Modifier.padding(vertical = Spacing.xs)) {
        Text("•  ", style = MaterialTheme.typography.bodyMedium)
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Preview
@Composable
private fun PreviewAbout() = NawahTheme {
    AboutScreen("0.3.0", "https://github.com/genius000-king/nawah", {}, {})
}
