package com.tvhub.tv.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Button
import androidx.tv.material3.Text as TvText
import com.tvhub.design.LocalBrandPalette
import com.tvhub.input.VideoPoint
import com.tvhub.input.tv.TvInputController
import com.tvhub.monitor.tv.CapabilityProbe
import com.tvhub.monitor.tv.ProbeReport
import com.tvhub.protocol.CONTROL_PORT
import com.tvhub.tv.R
import com.tvhub.tv.hub.HubStatusStore
import com.tvhub.tv.hub.TvHubService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val TEST_TAP_DELAY_MS = 3_000L
private val centre = VideoPoint(0.5f, 0.5f)

/**
 * Phase 1 proof screen. It starts the stream, runs a test tap, and shows what the device exposes.
 * It is a developer screen, removed or gated behind a setting in phase P2.
 */
@Composable
fun LabScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val status by HubStatusStore.state.collectAsState()
    val projectionManager = remember { context.getSystemService(MediaProjectionManager::class.java) }
    var report by remember { mutableStateOf<ProbeReport?>(null) }

    val consentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        onConsentResult(context, result.resultCode, result.data)
    }

    LaunchedEffect(Unit) {
        report = CapabilityProbe.run(context)
    }
    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 72.dp, vertical = 40.dp),
    ) {
        LabHeader(address = status.address, lastEvent = status.lastEvent)
        Spacer(Modifier.height(16.dp))
        LabControls(
            onStartStream = { consentLauncher.launch(projectionManager.createScreenCaptureIntent()) },
            onStopStream = { TvHubService.stop(context) },
            onTapTest = { scope.launch { runTapTest() } },
            onOpenAccessibility = { openAccessibilitySettings(context) },
        )
        Spacer(Modifier.height(20.dp))
        ProbeList(report = report)
    }
}

@Composable
private fun LabHeader(address: String?, lastEvent: String) {
    val palette = LocalBrandPalette.current
    Text(
        text = stringResource(R.string.lab_title),
        style = MaterialTheme.typography.headlineMedium,
        color = palette.content,
    )
    Spacer(Modifier.height(6.dp))
    Text(
        text = stringResource(R.string.lab_address, address ?: "—", CONTROL_PORT),
        style = MaterialTheme.typography.bodyLarge,
        color = palette.contentSecondary,
    )
    Text(
        text = lastEvent.ifEmpty { stringResource(R.string.lab_idle) },
        style = MaterialTheme.typography.bodyMedium,
        color = palette.contentSecondary,
    )
}

@Composable
private fun LabControls(
    onStartStream: () -> Unit,
    onStopStream: () -> Unit,
    onTapTest: () -> Unit,
    onOpenAccessibility: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(onClick = onStartStream) { TvText(stringResource(R.string.lab_start_stream)) }
        Button(onClick = onStopStream) { TvText(stringResource(R.string.lab_stop)) }
        Button(onClick = onTapTest) { TvText(stringResource(R.string.lab_tap_test)) }
        Button(onClick = onOpenAccessibility) { TvText(stringResource(R.string.lab_accessibility)) }
    }
}

@Composable
private fun ProbeList(report: ProbeReport?) {
    val palette = LocalBrandPalette.current
    LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        report?.sections?.forEach { section ->
            item {
                Text(
                    text = section.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.content,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
            items(section.items) { probe ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = probe.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.contentSecondary,
                        modifier = Modifier.weight(LABEL_WEIGHT),
                    )
                    Text(
                        text = probe.value,
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.content,
                        modifier = Modifier.weight(VALUE_WEIGHT),
                    )
                }
            }
        }
    }
}

private const val LABEL_WEIGHT = 1f
private const val VALUE_WEIGHT = 1.4f

private fun onConsentResult(context: Context, resultCode: Int, consent: Intent?) {
    if (resultCode == Activity.RESULT_OK && consent != null) {
        TvHubService.start(context, consent)
    } else {
        HubStatusStore.update { it.copy(lastEvent = "رُفض إذن التقاط الشاشة") }
    }
}

private suspend fun runTapTest() {
    delay(TEST_TAP_DELAY_MS)
    val delivered = TvInputController.tap(centre)
    HubStatusStore.update {
        it.copy(lastEvent = if (delivered) "نُفّذت نقرة اختبار" else "خدمة الإدخال غير مفعّلة")
    }
}

private fun openAccessibilitySettings(context: Context) {
    context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}
