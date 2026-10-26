package com.genius.tvhub.feature.phone.device

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.tvhub.core.common.formatBytes
import com.genius.tvhub.core.common.formatDuration
import com.genius.tvhub.core.designsystem.GlassCard
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.HubPage
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.KeyValueRow
import com.genius.tvhub.core.designsystem.MetricTile
import com.genius.tvhub.core.designsystem.PulseDot
import com.genius.tvhub.core.designsystem.Sparkline
import com.genius.tvhub.core.model.Availability
import com.genius.tvhub.core.model.ThermalLevel
import com.genius.tvhub.core.model.Reading

@Composable
fun DeviceRoute(onBack: () -> Unit, vm: DeviceViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    DeviceScreen(state, onBack)
}

/** One big ring for memory, four tiles, then cards that open in place for the details. */
@Composable
fun DeviceScreen(state: DeviceState, onBack: () -> Unit) {
    val c = Imlaq.colors
    HubPage(stringResource(R.string.dev_title), onBack) {
        val m = state.now
        val p = state.profile
        if (m == null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PulseDot(c.text); Text(stringResource(R.string.dev_loading), color = c.muted, style = MaterialTheme.typography.bodyMedium)
            }
            return@HubPage
        }
        GlassCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                Ring(m.memory.usedFraction, Modifier.size(112.dp))
                Column(Modifier.weight(1f)) {
                    Text(stringResource(R.string.dev_memory), style = MaterialTheme.typography.labelSmall, color = c.muted)
                    Text(formatBytes(m.memory.usedBytes), style = MaterialTheme.typography.titleLarge.copy(textDirection = TextDirection.ContentOrLtr), color = c.text)
                    Text(stringResource(R.string.dev_used_of, formatBytes(m.memory.totalBytes)), style = MaterialTheme.typography.bodySmall.copy(textDirection = TextDirection.ContentOrLtr), color = c.muted)
                    Sparkline(state.memoryHistory, Modifier.padding(top = 8.dp), max = 1f)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val disk = m.storage.firstOrNull()
            MetricTile(HubIcons.Storage, stringResource(R.string.dev_storage), disk?.let { formatBytes(it.totalBytes - it.freeBytes) }, Modifier.weight(1f), fraction = disk?.usedFraction, caption = disk?.let { stringResource(R.string.dev_used_of, formatBytes(it.totalBytes)) })
            MetricTile(HubIcons.Thermometer, stringResource(R.string.dev_temp), m.thermal.celsius.value?.let { "%.0f°".format(it) } ?: m.thermal.level.value?.let { thermalLabel(it) }, Modifier.weight(1f), caption = if (m.thermal.celsius.value != null) m.thermal.level.value?.let { thermalLabel(it) } else null)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricTile(HubIcons.Wifi, stringResource(R.string.dev_network), "${formatBytes(m.network.rxBytesPerSec)}/s", Modifier.weight(1f), caption = ipv4First(m.network.addresses).firstOrNull())
            MetricTile(HubIcons.Clock, stringResource(R.string.dev_uptime), formatDuration(m.uptimeMillis), Modifier.weight(1f))
        }

        Expandable(HubIcons.Cpu, stringResource(R.string.dev_cpu), p?.socModel?.value) {
            p?.let {
                Fact(stringResource(R.string.dev_chip), it.socModel)
                KeyValueRow(stringResource(R.string.dev_cores), it.cpuCores.toString())
                // Says plainly why many phone apps refuse to install: a 32-bit-only system.
                KeyValueRow(
                    stringResource(R.string.dev_apps_arch),
                    "${stringResource(if (it.abis.any { a -> "64" in a }) R.string.dev_arch_64 else R.string.dev_arch_32)}\n${it.abis.joinToString(" · ")}",
                    valueColor = if (it.abis.none { a -> "64" in a }) Imlaq.colors.warn else null,
                )
            }
            Fact(stringResource(R.string.dev_load), m.cpu.loadFraction.map { "${(it * 100).toInt()}%" })
            Fact(stringResource(R.string.dev_freq), m.cpu.curFreqKhz.map { f -> f.joinToString(" · ") { "${it / 1000}" } + " MHz" })
            KeyValueRow(stringResource(R.string.dev_app_cpu), "${(m.cpu.appCpuFraction * 100).toInt()}%")
        }
        Expandable(HubIcons.Gpu, stringResource(R.string.dev_gpu), p?.gpuRenderer?.value) {
            p?.let {
                Fact(stringResource(R.string.dev_renderer), it.gpuRenderer)
                Fact(stringResource(R.string.dev_vendor), it.gpuVendor)
                Fact(stringResource(R.string.dev_gl), it.glVersion)
            }
            Fact(stringResource(R.string.dev_gpu_usage), Reading.unsupported<String>(stringResource(R.string.dev_gpu_usage_na)))
        }
        Expandable(HubIcons.Wifi, stringResource(R.string.dev_network), m.network.kind.name.lowercase()) {
            KeyValueRow(stringResource(R.string.dev_address), ipv4First(m.network.addresses).joinToString("\n").ifEmpty { "—" })
            Fact(stringResource(R.string.dev_signal), m.network.wifiRssiDbm.map { "$it dBm" })
            Fact(stringResource(R.string.dev_link), m.network.linkSpeedMbps.map { "$it Mbps" })
            KeyValueRow(stringResource(R.string.dev_down), "${formatBytes(m.network.rxBytesPerSec)}/s")
            KeyValueRow(stringResource(R.string.dev_up), "${formatBytes(m.network.txBytesPerSec)}/s")
            Sparkline(state.rxHistory)
        }
        Expandable(HubIcons.Tv, stringResource(R.string.dev_system), p?.let { "Android ${it.androidVersion}" }) {
            p?.let {
                KeyValueRow(stringResource(R.string.dev_model), "${it.manufacturer} ${it.model}")
                KeyValueRow(stringResource(R.string.dev_android), "${it.androidVersion} (API ${it.sdkInt})")
                KeyValueRow(stringResource(R.string.dev_patch), it.securityPatch)
                KeyValueRow(stringResource(R.string.dev_resolution), "${it.displayWidth}×${it.displayHeight} · ${it.refreshRate.toInt()} Hz")
            }
            Fact(stringResource(R.string.dev_thermal_state), Reading(m.thermal.level.value?.let { thermalLabel(it) }, m.thermal.level.availability))
        }
    }
}

/** Home networks are reached by their IPv4 address; long IPv6 ones go last. */
private fun ipv4First(addresses: List<String>) = addresses.sortedBy { ':' in it }

@Composable
private fun thermalLabel(level: ThermalLevel): String = stringResource(
    when (level) {
        ThermalLevel.NONE -> R.string.dev_th_none
        ThermalLevel.LIGHT -> R.string.dev_th_light
        ThermalLevel.MODERATE -> R.string.dev_th_moderate
        ThermalLevel.SEVERE -> R.string.dev_th_severe
        else -> R.string.dev_th_critical
    },
)

private fun <T, R> Reading<T>.map(f: (T) -> R): Reading<R> = Reading(value?.let(f), availability)

/** A fact that may not exist on this TV: the value, or why not. */
@Composable
private fun Fact(label: String, reading: Reading<String>) {
    val c = Imlaq.colors
    when (val a = reading.availability) {
        Availability.Available -> KeyValueRow(label, reading.value ?: "—")
        // The engine's reasons are for logs; on screen, one short phrase in the user's language.
        is Availability.NeedsAdb -> KeyValueRow(label, stringResource(R.string.dev_needs_adb), valueColor = c.faint)
        is Availability.Unsupported -> KeyValueRow(label, stringResource(R.string.dev_not_offered), valueColor = c.faint)
    }
}

/** A card that opens in place: details only for those who ask. */
@Composable
private fun Expandable(icon: ImageVector, title: String, summary: String?, content: @Composable () -> Unit) {
    val c = Imlaq.colors
    var open by rememberSaveable(title) { mutableStateOf(false) }
    GlassCard(Modifier.animateContentSize(), onClick = { open = !open }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, null, tint = c.text, modifier = Modifier.size(18.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = c.text)
                if (!summary.isNullOrBlank()) Text(summary, style = MaterialTheme.typography.bodySmall, color = c.muted, maxLines = 1)
            }
            val turn by animateFloatAsState(if (open) 180f else 0f, tween(200), label = "chev")
            Icon(HubIcons.ChevronDown, null, tint = c.faint, modifier = Modifier.size(16.dp).rotate(turn))
        }
        if (open) Column(Modifier.padding(top = 8.dp)) { content() }
    }
}

/** Memory as a ring: the arc grows on a tween when the value changes. */
@Composable
private fun Ring(fraction: Float, modifier: Modifier) {
    val c = Imlaq.colors
    val f by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(600), label = "ring")
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxWidth().size(112.dp)) {
            val stroke = 9.dp.toPx()
            val inset = stroke / 2
            val arcSize = Size(size.width - stroke, size.height - stroke)
            drawArc(c.line, -90f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
            drawArc(if (f > 0.85f) c.warn else c.text, -90f, 360f * f, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Text("${(f * 100).toInt()}%", fontSize = 22.sp, style = MaterialTheme.typography.titleLarge.copy(textDirection = TextDirection.Ltr), color = c.text)
    }
}

