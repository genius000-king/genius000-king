package com.genius.saraat.ui

import android.app.Activity
import android.net.VpnService
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.saraat.Controller
import com.genius.saraat.R
import com.genius.saraat.data.AppMode
import com.genius.saraat.data.Live
import com.genius.saraat.data.Prefs
import com.genius.saraat.data.formatLimit
import com.genius.saraat.data.formatRate
import com.genius.saraat.data.limitParts
import kotlin.math.roundToInt

private val Presets = listOf(512, 1000, 2000, 5000, 10000)
private val Timers = listOf(0 to "بدون", 15 to "15 د", 30 to "30 د", 60 to "ساعة", 120 to "ساعتان")

@Composable
fun HomeScreen(onOpenApps: () -> Unit) {
    val ctx = LocalContext.current
    val s by Prefs.state.collectAsStateWithLifecycle()
    val speed by Live.speed.collectAsStateWithLifecycle()
    val history by Live.history.collectAsStateWithLifecycle()
    val message by Live.message.collectAsStateWithLifecycle()
    var customFor by remember { mutableStateOf<Direction?>(null) }

    // Ticks once a second so the countdown text stays fresh.
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(s.timerEndsAt) {
        while (s.timerEndsAt > 0) {
            now = System.currentTimeMillis()
            kotlinx.coroutines.delay(1000)
        }
    }

    val vpnConsent = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        if (r.resultCode == Activity.RESULT_OK) Controller.setLimitEnabled(ctx, true)
    }

    fun toggle() {
        if (s.limitEnabled) {
            Controller.setLimitEnabled(ctx, false)
            return
        }
        if (!s.appsValid) {
            Live.message.value = "اختر تطبيقًا واحدًا على الأقل من قسم التطبيقات."
            return
        }
        val consent = VpnService.prepare(ctx)
        if (consent != null) vpnConsent.launch(consent) else Controller.setLimitEnabled(ctx, true)
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Header()

        message?.let { text ->
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFFFECEC))
                    .clickable { Live.message.value = null }.padding(14.dp),
            ) { Text(text, style = MaterialTheme.typography.bodyMedium, color = Palette.Warn) }
        }

        Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
            val remaining = if (s.limitEnabled && s.timerEndsAt > 0) (s.timerEndsAt - now).coerceAtLeast(0) else null
            SpeedDial(s.limitEnabled, s.downKbps, remaining, ::toggle)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LiveCard(
                "تنزيل", R.drawable.ic_arrow_down, formatRate(speed.down), history.map { it.down.toFloat() },
                Modifier.weight(1f),
            )
            LiveCard(
                "رفع", R.drawable.ic_arrow_up, formatRate(speed.up), history.map { it.up.toFloat() },
                Modifier.weight(1f),
            )
        }

        SectionTitle("الحد الأقصى للسرعة")
        SpeedChips(s.downKbps, onPick = { Controller.setDownKbps(ctx, it) }, onCustom = { customFor = Direction.Down })

        Panel {
            ToggleRow(
                R.drawable.ic_arrow_up, "حد منفصل للرفع",
                if (s.separateUpload) "الرفع: ${formatLimit(s.upKbps)}" else "الرفع يتبع حد التنزيل",
                s.separateUpload, { Controller.setSeparateUpload(ctx, it) },
            )
            if (s.separateUpload) {
                Spacer(Modifier.height(12.dp))
                SpeedChips(s.upKbps, onPick = { Controller.setUpKbps(ctx, it) }, onCustom = { customFor = Direction.Up })
            }
        }

        Panel {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconBadge(R.drawable.ic_timer)
                Column(Modifier.weight(1f)) {
                    Text("إيقاف تلقائي", style = MaterialTheme.typography.bodyLarge)
                    Muted("يطفئ التحديد وحده بعد المدة")
                }
            }
            Spacer(Modifier.height(12.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Timers.forEach { (min, label) ->
                    Chip(label, s.timerMinutes == min, { Controller.setTimer(ctx, min) })
                }
            }
        }

        Panel(onClick = onOpenApps) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconBadge(R.drawable.ic_grid)
                Column(Modifier.weight(1f)) {
                    Text("التطبيقات", style = MaterialTheme.typography.bodyLarge)
                    Muted(
                        when (s.appMode) {
                            AppMode.ALL -> "الحد يشمل كل التطبيقات"
                            AppMode.ONLY -> "فقط ${s.apps.size} تطبيق محدد"
                            AppMode.EXCEPT -> "الكل ما عدا ${s.apps.size} تطبيق"
                        },
                    )
                }
                Ico(R.drawable.ic_chevron, tint = Palette.Muted)
            }
        }
        Spacer(Modifier.height(8.dp))
    }

    customFor?.let { dir ->
        CustomSpeedDialog(
            initialKbps = if (dir == Direction.Down) s.downKbps else s.upKbps,
            onDismiss = { customFor = null },
            onConfirm = { kbps ->
                if (dir == Direction.Down) Controller.setDownKbps(ctx, kbps) else Controller.setUpKbps(ctx, kbps)
                customFor = null
            },
        )
    }
}

private enum class Direction { Down, Up }

@Composable
private fun Header() {
    Row(
        Modifier.fillMaxWidth().padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(Palette.Blue), contentAlignment = Alignment.Center) {
            Ico(R.drawable.ic_gauge, tint = Color.White, size = 22.dp)
        }
        Text("سرعات", style = MaterialTheme.typography.headlineMedium)
    }
}

/** The big round button: ring + current limit. Tap to switch the limit on or off. */
@Composable
private fun SpeedDial(enabled: Boolean, limitKbps: Int, remainingMs: Long?, onClick: () -> Unit) {
    val progress by animateFloatAsState(if (enabled) 1f else 0f, tween(800), label = "ring")
    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        0.10f, 0.26f, infiniteRepeatable(tween(1800), RepeatMode.Reverse), label = "pulseAlpha",
    )
    val (number, unit) = limitParts(limitKbps)

    Box(Modifier.size(260.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = 16.dp.toPx()
            val inset = 22.dp.toPx()
            val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
            val topLeft = Offset(inset, inset)
            if (enabled) {
                drawCircle(Palette.Blue.copy(alpha = pulse * progress), radius = size.minDimension / 2 - 2.dp.toPx())
            }
            drawArc(Palette.Track, 135f, 270f, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            if (progress > 0.01f) {
                rotate(135f) {
                    drawArc(
                        brush = Brush.sweepGradient(0f to Palette.BlueLight, 0.75f to Palette.Blue, 1f to Palette.Blue),
                        startAngle = 0f, sweepAngle = 270f * progress, useCenter = false,
                        topLeft = topLeft, size = arcSize, style = Stroke(stroke, cap = StrokeCap.Round),
                    )
                }
            }
        }
        Box(
            Modifier.size(178.dp).clip(CircleShape).background(Color.White).clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Ico(R.drawable.ic_power, tint = if (enabled) Palette.Blue else Palette.Muted, size = 30.dp)
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            number, style = MaterialTheme.typography.displayLarge,
                            color = if (enabled) Palette.Ink else Palette.Muted,
                        )
                        Text(
                            unit, Modifier.padding(bottom = 10.dp), style = MaterialTheme.typography.titleMedium,
                            color = Palette.Muted,
                        )
                    }
                }
                Text(
                    when {
                        !enabled -> "اضغط للتشغيل"
                        remainingMs != null -> "يتوقف بعد ${formatCountdown(remainingMs)}"
                        else -> "التحديد يعمل"
                    },
                    style = MaterialTheme.typography.labelLarge,
                    color = if (enabled) Palette.Blue else Palette.Muted,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

private fun formatCountdown(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val sec = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, sec) else "%02d:%02d".format(m, sec)
}

@Composable
private fun LiveCard(title: String, icon: Int, value: String, samples: List<Float>, modifier: Modifier = Modifier) {
    Panel(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Ico(icon, tint = Palette.Blue, size = 18.dp)
            Muted(title)
        }
        Text(value, Modifier.padding(top = 6.dp, bottom = 8.dp), style = MaterialTheme.typography.titleLarge)
        Sparkline(samples, Modifier.fillMaxWidth().height(34.dp))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SpeedChips(currentKbps: Int, onPick: (Int) -> Unit, onCustom: () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Presets.forEach { kbps -> Chip(formatLimit(kbps), currentKbps == kbps, { onPick(kbps) }) }
        val custom = currentKbps !in Presets
        Chip(if (custom) "مخصص · ${formatLimit(currentKbps)}" else "مخصص", custom, onCustom)
    }
}

@Composable
private fun CustomSpeedDialog(initialKbps: Int, onDismiss: () -> Unit, onConfirm: (Int) -> Unit) {
    var megabits by remember { mutableStateOf(initialKbps >= 1000) }
    var text by remember {
        mutableStateOf(
            if (initialKbps >= 1000) (initialKbps / 1000.0).toString().removeSuffix(".0") else initialKbps.toString(),
        )
    }
    val value = text.toDoubleOrNull()
    val kbps = value?.let { (it * if (megabits) 1000 else 1).roundToInt() }
    val valid = kbps != null && kbps in 8..1_000_000

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        title = { Text("سرعة مخصصة", style = MaterialTheme.typography.titleLarge) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                OutlinedTextField(
                    value = text,
                    onValueChange = { v -> if (v.length <= 8 && v.all { it.isDigit() || it == '.' }) text = v },
                    singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    isError = text.isNotEmpty() && !valid,
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Palette.Surface, unfocusedContainerColor = Palette.Surface,
                        focusedIndicatorColor = Palette.Blue, unfocusedIndicatorColor = Palette.Outline,
                    ),
                    textStyle = MaterialTheme.typography.titleLarge.copy(fontSize = 22.sp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Chip("Kbps", !megabits, { megabits = false })
                    Chip("Mbps", megabits, { megabits = true })
                }
                Muted(if (text.isNotEmpty() && !valid) "اكتب قيمة بين 8 Kbps و 1000 Mbps" else "مثال: 750 Kbps أو 2.5 Mbps")
            }
        },
        confirmButton = {
            TextButton({ if (valid) onConfirm(kbps!!) }, enabled = valid) {
                Text("تطبيق", color = if (valid) Palette.Blue else Palette.Muted, style = MaterialTheme.typography.labelLarge)
            }
        },
        dismissButton = {
            TextButton(onDismiss) { Text("إلغاء", color = Palette.Muted, style = MaterialTheme.typography.labelLarge) }
        },
    )
}
