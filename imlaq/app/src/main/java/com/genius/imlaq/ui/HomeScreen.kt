package com.genius.imlaq.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.imlaq.R
import com.genius.imlaq.common.Bytes
import com.genius.imlaq.designsystem.BrandMark
import com.genius.imlaq.designsystem.FloatingTopBar
import com.genius.imlaq.designsystem.GhostPillButton
import com.genius.imlaq.designsystem.GlassCard
import com.genius.imlaq.designsystem.HeroTitle
import com.genius.imlaq.designsystem.IconCircleButton
import com.genius.imlaq.designsystem.Imlaq
import com.genius.imlaq.designsystem.ImlaqBackground
import com.genius.imlaq.designsystem.MoonIcon
import com.genius.imlaq.designsystem.PillButton
import com.genius.imlaq.designsystem.SectionHeader
import com.genius.imlaq.designsystem.StatRow
import com.genius.imlaq.designsystem.StatusChip
import com.genius.imlaq.designsystem.SunIcon
import com.genius.imlaq.designsystem.Tag
import com.genius.imlaq.designsystem.UsageBar
import com.genius.imlaq.device.DeviceProfile
import com.genius.imlaq.models.ModelKind
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
fun HomeRoute(viewModel: HomeViewModel, dark: Boolean, onToggleTheme: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeScreen(state, dark, onToggleTheme)
}

@Composable
fun HomeScreen(state: HomeState, dark: Boolean, onToggleTheme: () -> Unit) {
    val scroll = rememberScrollState()
    val scope = rememberCoroutineScope()
    val deviceY = remember { mutableIntStateOf(0) }
    val modelsY = remember { mutableIntStateOf(0) }
    val c = Imlaq.colors

    ImlaqBackground {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(12.dp))
            val themeLabel = stringResource(R.string.theme_toggle)
            FloatingTopBar(
                brand = {
                    BrandMark()
                    Spacer(Modifier.width(12.dp))
                    Text(stringResource(R.string.app_name), style = MaterialTheme.typography.titleLarge, color = c.textPrimary)
                },
                actions = {
                    IconCircleButton(
                        onClick = onToggleTheme,
                        modifier = Modifier.semantics { contentDescription = themeLabel },
                    ) { if (dark) SunIcon() else MoonIcon() }
                    PillButton(
                        text = stringResource(R.string.nav_models),
                        onClick = { scope.launch { scroll.animateScrollTo(modelsY.intValue) } },
                    )
                },
            )

            // ── hero ──
            Spacer(Modifier.height(64.dp))
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                StatusChip(
                    text = stringResource(if (state.textEngineBundled) R.string.status_engine_ready else R.string.status_engine_missing),
                    dot = if (state.textEngineBundled) c.success else c.warning,
                )
                Spacer(Modifier.height(32.dp))
                HeroTitle(stringResource(R.string.hero_primary), stringResource(R.string.hero_secondary))
                Spacer(Modifier.height(24.dp))
                Text(
                    stringResource(R.string.hero_body),
                    style = MaterialTheme.typography.bodyLarge,
                    color = c.textSecondary,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(36.dp))
                PillButton(
                    text = stringResource(R.string.cta_pick_model),
                    onClick = { scope.launch { scroll.animateScrollTo(modelsY.intValue) } },
                    modifier = Modifier.fillMaxWidth(0.8f),
                )
                Spacer(Modifier.height(14.dp))
                GhostPillButton(
                    text = stringResource(R.string.cta_device),
                    onClick = { scope.launch { scroll.animateScrollTo(deviceY.intValue) } },
                    modifier = Modifier.fillMaxWidth(0.8f),
                )
            }

            // ── device ──
            Spacer(Modifier.height(88.dp))
            Column(Modifier.onGloballyPositioned { deviceY.intValue = it.positionInParent().y.toInt() }) {
                SectionHeader(stringResource(R.string.device_eyebrow), stringResource(R.string.device_title))
                Spacer(Modifier.height(20.dp))
                state.profile?.let { DeviceCard(it, state.reserve, state.budget) }
            }

            // ── models ──
            Spacer(Modifier.height(72.dp))
            Column(Modifier.onGloballyPositioned { modelsY.intValue = it.positionInParent().y.toInt() }) {
                SectionHeader(stringResource(R.string.models_eyebrow), stringResource(R.string.models_title))
                Spacer(Modifier.height(20.dp))
                if (!state.loading && state.models.isEmpty()) {
                    GlassCard(eyebrow = stringResource(R.string.models_empty_title)) {
                        Text(stringResource(R.string.models_empty_body), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                        Spacer(Modifier.height(10.dp))
                        Text(state.modelsDir, style = MaterialTheme.typography.bodySmall, color = c.textPrimary)
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    state.models.forEach { ModelCard(it) }
                }
            }

            // ── how it works ──
            Spacer(Modifier.height(72.dp))
            SectionHeader(stringResource(R.string.how_eyebrow), stringResource(R.string.how_title))
            Spacer(Modifier.height(20.dp))
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                HowCard("01", stringResource(R.string.how_1_title), stringResource(R.string.how_1_body))
                HowCard("02", stringResource(R.string.how_2_title), stringResource(R.string.how_2_body))
                HowCard("03", stringResource(R.string.how_3_title), stringResource(R.string.how_3_body))
            }

            Spacer(Modifier.height(56.dp))
            Text(
                stringResource(R.string.footer, appVersion()),
                style = MaterialTheme.typography.labelSmall,
                color = c.textMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun DeviceCard(p: DeviceProfile, reserve: Bytes, budget: Bytes) {
    val c = Imlaq.colors
    GlassCard(eyebrow = stringResource(R.string.device_card_label)) {
        StatRow(stringResource(R.string.device_model), "${p.manufacturer} ${p.model}")
        StatRow(stringResource(R.string.device_soc), p.socModel ?: stringResource(R.string.unknown))
        StatRow(
            stringResource(R.string.device_cores),
            stringResource(R.string.device_cores_value, p.performanceCores.size, p.cores.size),
        )
        StatRow(stringResource(R.string.device_ram_total), formatBytes(p.memory.total))
        StatRow(stringResource(R.string.device_ram_available), formatBytes(p.memory.available))
        val used = 1f - (p.memory.available.value.toFloat() / p.memory.total.value.coerceAtLeast(1))
        UsageBar(used, Modifier.padding(vertical = 6.dp))
        StatRow(stringResource(R.string.device_reserve), formatBytes(reserve))
        StatRow(stringResource(R.string.device_budget), formatBytes(budget), valueColor = c.success)
        StatRow(stringResource(R.string.device_storage), formatBytes(p.modelStorageFree))
        val h = p.thermalHeadroom
        StatRow(
            stringResource(R.string.device_thermal),
            stringResource(
                when {
                    h == null -> R.string.thermal_unknown
                    h < 0.5f -> R.string.thermal_cool
                    h < 0.85f -> R.string.thermal_warm
                    else -> R.string.thermal_hot
                },
            ),
            valueColor = when {
                h == null -> null
                h < 0.5f -> c.success
                h < 0.85f -> c.warning
                else -> c.danger
            },
        )
    }
}

@Composable
private fun ModelCard(row: ModelRow) {
    val c = Imlaq.colors
    val m = row.model
    val s = m.summary
    GlassCard {
        Text(m.displayName, style = MaterialTheme.typography.titleMedium, color = c.textPrimary)
        Spacer(Modifier.height(10.dp))
        if (s == null) {
            Text(stringResource(R.string.model_error, m.error.orEmpty()), style = MaterialTheme.typography.bodySmall, color = c.danger)
            return@GlassCard
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Tag(
                stringResource(
                    when (s.kind) {
                        ModelKind.TEXT_MOE -> R.string.model_kind_moe
                        ModelKind.TEXT_DENSE -> R.string.model_kind_dense
                        ModelKind.VISION_PROJECTOR -> R.string.model_kind_vision
                        ModelKind.OTHER -> R.string.model_kind_other
                    },
                ),
                color = if (s.kind == ModelKind.TEXT_MOE) c.success else null,
            )
            Tag(s.architecture)
            if (m.shards.size > 1) Tag("${m.shards.size} ×")
        }
        Spacer(Modifier.height(12.dp))
        StatRow(stringResource(R.string.model_size), formatBytes(s.totalBytes))
        if (s.kind == ModelKind.TEXT_MOE) {
            StatRow(stringResource(R.string.model_experts), stringResource(R.string.model_experts_value, s.expertUsedCount, s.expertCount))
            StatRow(stringResource(R.string.model_resident), formatBytes(s.denseBytes))
        }
        row.estimate?.let { e ->
            StatRow(stringResource(R.string.model_flash_per_token), formatBytes(e.flashBytesPerToken))
            if (e.runnable) {
                StatRow(
                    stringResource(R.string.model_speed),
                    stringResource(R.string.model_speed_value, String.format(Locale.US, "%.2f", e.tokensPerSecond)),
                    valueColor = c.success,
                )
            } else {
                Text(stringResource(R.string.model_not_runnable), style = MaterialTheme.typography.bodySmall, color = c.danger)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                stringResource(R.string.model_estimate_note, String.format(Locale.US, "%.0f", HomeViewModel.ASSUMED_FLASH_BYTES_PER_S / 1e9)),
                style = MaterialTheme.typography.bodySmall,
                color = c.textMuted,
            )
        }
    }
}

@Composable
private fun HowCard(number: String, title: String, body: String) {
    val c = Imlaq.colors
    GlassCard {
        Text(number, style = MaterialTheme.typography.labelMedium, color = c.textMuted)
        Spacer(Modifier.height(8.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, color = c.textPrimary)
        Spacer(Modifier.height(6.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
    }
}

@Composable
private fun appVersion(): String {
    val context = LocalContext.current
    return remember {
        runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull() ?: ""
    }
}

/** Sizes the way people read them on a phone spec sheet, in Arabic units. */
fun formatBytes(b: Bytes): String = when {
    b.gib >= 1 -> String.format(Locale.US, "%.1f جيجا", b.gib)
    b.mib >= 1 -> String.format(Locale.US, "%.0f ميجا", b.mib)
    else -> String.format(Locale.US, "%.0f كيلو", b.kib)
}
