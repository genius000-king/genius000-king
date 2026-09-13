package io.nawah.linux.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Usb
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import io.nawah.linux.R
import io.nawah.linux.usb.UsbSerialDevice
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing

/**
 * What is plugged in, and how it reaches Linux.
 *
 * The two explanatory blocks at the bottom are not filler. Android's refusal to
 * let a program inside the container open a USB device is the whole reason this
 * screen exists, and the missing DTR line is the one thing that will otherwise
 * waste an evening — both are cheaper said here than discovered.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UsbScreen(
    devices: List<UsbSerialDevice>,
    ttyPath: String,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onGrant: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.usb_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back))
                    }
                },
                actions = {
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Filled.Refresh, stringResource(R.string.usb_refresh))
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
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            if (devices.isEmpty()) {
                Text(
                    stringResource(R.string.usb_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.xl),
                )
            } else {
                devices.forEach { device -> DeviceCard(device, onGrant) }
            }

            Explainer(
                title = stringResource(R.string.usb_how_title),
                body = stringResource(R.string.usb_how_body, ttyPath),
            )
            Explainer(
                title = stringResource(R.string.usb_limit_title),
                body = stringResource(R.string.usb_limit_body),
            )
        }
    }
}

@Composable
private fun DeviceCard(device: UsbSerialDevice, onGrant: (String) -> Unit) {
    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Usb, null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(Spacing.md))
            Column(Modifier.weight(1f)) {
                Text(
                    device.productName ?: device.driverName,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    "${device.id} · ${device.driverName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (device.granted) {
                Text(
                    stringResource(R.string.usb_granted),
                    style = MaterialTheme.typography.labelLarge,
                    color = NawahTheme.status.good,
                )
            } else {
                FilledTonalButton(onClick = { onGrant(device.deviceName) }) {
                    Text(stringResource(R.string.usb_grant))
                }
            }
        }
    }
}

@Composable
private fun Explainer(title: String, body: String) {
    Column {
        Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(Spacing.xs))
        Text(
            body,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Preview
@Composable
private fun PreviewUsb() = NawahTheme {
    UsbScreen(
        devices = listOf(
            UsbSerialDevice("/dev/bus/usb/001/002", "USB2.0-Serial", 0x1a86, 0x7523, "Ch34x", false),
        ),
        ttyPath = "/dev/ttyUSB0",
        onBack = {}, onRefresh = {}, onGrant = {},
    )
}
