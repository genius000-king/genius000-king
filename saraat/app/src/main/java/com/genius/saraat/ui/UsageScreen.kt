package com.genius.saraat.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.genius.saraat.R
import com.genius.saraat.data.AppInfo
import com.genius.saraat.data.AppTotal
import com.genius.saraat.data.NetTotals
import com.genius.saraat.data.UsageDb
import com.genius.saraat.data.formatBytes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.util.Locale

internal enum class Range(val label: String) {
    Hour("آخر ساعة"), Day("اليوم"), Week("7 أيام"), Month("30 يوم")
}

internal class Report(
    val starts: LongArray,       // bucket start times in epoch ms, plus the end of the last bucket
    val bars: List<Bar>,
    val down: Long,
    val up: Long,
    val net: NetTotals,
    val apps: List<AppTotal>,
    val range: Range,
)

private val DayNames = arrayOf("الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد")

private fun two(n: Int) = String.format(Locale.US, "%02d", n)

private fun bucketLabel(range: Range, startMs: Long): String {
    val t = ZonedDateTime.ofInstant(Instant.ofEpochMilli(startMs), ZoneId.systemDefault())
    return when (range) {
        Range.Hour -> "${two(t.hour)}:${two(t.minute)}"
        Range.Day -> "${two(t.hour)}:00"
        Range.Week -> DayNames[t.dayOfWeek.value - 1]
        Range.Month -> "${t.dayOfMonth}/${t.monthValue}"
    }
}

private fun load(db: UsageDb, range: Range): Report {
    val zone = ZoneId.systemDefault()
    val now = ZonedDateTime.now(zone)
    val starts: List<ZonedDateTime> = when (range) {
        Range.Hour -> now.truncatedTo(ChronoUnit.MINUTES).let { end -> (59 downTo 0).map { end.minusMinutes(it.toLong()) } }
        Range.Day -> now.truncatedTo(ChronoUnit.HOURS).let { end -> (23 downTo 0).map { end.minusHours(it.toLong()) } }
        Range.Week -> now.truncatedTo(ChronoUnit.DAYS).let { end -> (6 downTo 0).map { end.minusDays(it.toLong()) } }
        Range.Month -> now.truncatedTo(ChronoUnit.DAYS).let { end -> (29 downTo 0).map { end.minusDays(it.toLong()) } }
    }
    val unit: (ZonedDateTime) -> ZonedDateTime = when (range) {
        Range.Hour -> { t -> t.plusMinutes(1) }
        Range.Day -> { t -> t.plusHours(1) }
        else -> { t -> t.plusDays(1) }
    }
    val bounds = LongArray(starts.size + 1) { i ->
        (if (i < starts.size) starts[i] else unit(starts.last())).toInstant().toEpochMilli()
    }
    val fromMinute = bounds.first() / 60_000
    val toMinute = bounds.last() / 60_000

    val down = LongArray(starts.size)
    val up = LongArray(starts.size)
    var idx = 0
    for (row in db.perMinute(fromMinute, toMinute)) {
        val t = row.minute * 60_000
        while (idx < starts.size - 1 && t >= bounds[idx + 1]) idx++
        down[idx] += row.down
        up[idx] += row.up
    }
    return Report(
        bounds, starts.indices.map { Bar(down[it], up[it]) }, down.sum(), up.sum(),
        db.perNetwork(fromMinute, toMinute), db.perApp(fromMinute, toMinute), range,
    )
}

@Composable
fun UsageScreen() {
    val ctx = LocalContext.current
    val db = remember { UsageDb.get(ctx) }
    var range by rememberSaveable { mutableIntStateOf(0) }
    var report by remember { mutableStateOf<Report?>(null) }
    var selected by remember { mutableStateOf<Int?>(null) }
    var confirmClear by remember { mutableStateOf(false) }
    var refresh by remember { mutableIntStateOf(0) }

    LaunchedEffect(range, refresh) {
        report = withContext(Dispatchers.IO) { load(db, Range.entries[range]) }
    }
    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            refresh++
        }
    }

    val scope = rememberCoroutineScope()
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) scope.launch(Dispatchers.IO) { writeCsv(ctx, db, uri) }
    }

    UsageContent(
        report = report,
        rangeIndex = range,
        onRange = { range = it; selected = null },
        selected = selected,
        onSelect = { selected = it },
        onExport = { export.launch("saraat-usage.csv") },
        onClear = { confirmClear = true },
    )

    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            containerColor = Color.White,
            title = { Text("مسح السجل كله؟", style = MaterialTheme.typography.titleLarge) },
            text = { Text("لا يمكن التراجع عن هذا الإجراء.", style = MaterialTheme.typography.bodyMedium) },
            confirmButton = {
                TextButton({
                    confirmClear = false
                    scope.launch {
                        withContext(Dispatchers.IO) { db.clear() }
                        refresh++
                    }
                }) { Text("مسح", color = Palette.Warn, style = MaterialTheme.typography.labelLarge) }
            },
            dismissButton = {
                TextButton({ confirmClear = false }) { Text("إلغاء", color = Palette.Muted, style = MaterialTheme.typography.labelLarge) }
            },
        )
    }
}

@Composable
internal fun UsageContent(
    report: Report?,
    rangeIndex: Int,
    onRange: (Int) -> Unit,
    selected: Int?,
    onSelect: (Int?) -> Unit,
    onExport: () -> Unit,
    onClear: () -> Unit,
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("السجل", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.headlineMedium)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Range.entries.forEachIndexed { i, r -> Chip(r.label, rangeIndex == i, { onRange(i) }) }
        }

        if (report == null) {
            Muted("جارٍ التحميل…")
        } else {
            Summary(report)
            ChartPanel(report, selected, onSelect)
            AppsPanel(report.apps)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ActionButton("تصدير CSV", R.drawable.ic_download, Modifier.weight(1f), onClick = onExport)
            ActionButton("مسح السجل", R.drawable.ic_trash, Modifier.weight(1f), danger = true, onClick = onClear)
        }
        Muted(
            "الأرقام تقديرية: تُحسب بحجم البيانات دون ترويسات الحزم، فتظهر أقل بنحو 2–4% من عدّاد شركة الاتصالات.",
        )
        Spacer(Modifier.height(8.dp))
    }
}


@Composable
private fun Summary(rep: Report) {
    Panel {
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Ico(R.drawable.ic_arrow_down, tint = Palette.Blue, size = 16.dp)
                    Muted("تنزيل")
                }
                Text(formatBytes(rep.down), style = MaterialTheme.typography.headlineMedium)
            }
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Ico(R.drawable.ic_arrow_up, tint = Palette.BlueLight, size = 16.dp)
                    Muted("رفع")
                }
                Text(formatBytes(rep.up), style = MaterialTheme.typography.headlineMedium)
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NetPill(R.drawable.ic_wifi, "واي فاي", rep.net.wifiDown + rep.net.wifiUp, Modifier.weight(1f))
            NetPill(R.drawable.ic_phone, "بيانات الجوال", rep.net.mobileDown + rep.net.mobileUp, Modifier.weight(1f))
        }
    }
}

@Composable
private fun NetPill(icon: Int, label: String, bytes: Long, modifier: Modifier) {
    Row(
        modifier.clip(RoundedCornerShape(14.dp)).background(Color.White).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Ico(icon, tint = Palette.Blue, size = 18.dp)
        Column {
            Muted(label)
            Text(formatBytes(bytes), style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun ChartPanel(rep: Report, selected: Int?, onSelect: (Int?) -> Unit) {
    val peak = rep.bars.maxOfOrNull { it.total } ?: 0L
    val n = rep.bars.size
    Panel {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("الاستهلاك عبر الزمن", style = MaterialTheme.typography.titleMedium)
            Muted(if (peak > 0) "الأعلى ${formatBytes(peak)}" else "")
        }
        Spacer(Modifier.height(12.dp))
        BarChart(rep.bars, selected, onSelect, Modifier.fillMaxWidth().height(130.dp))
        Spacer(Modifier.height(8.dp))
        // Same left-to-right direction as the chart above it, oldest on the left.
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf(0, n / 2, n - 1).forEach { i -> Muted(bucketLabel(rep.range, rep.starts[i])) }
            }
        }
        Spacer(Modifier.height(10.dp))
        val sel = selected?.takeIf { it in rep.bars.indices }
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White).padding(12.dp),
        ) {
            if (sel == null) {
                Muted("المس عمودًا لعرض التفاصيل", align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            } else {
                val b = rep.bars[sel]
                Column {
                    Text(bucketLabel(rep.range, rep.starts[sel]), style = MaterialTheme.typography.labelLarge)
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Ico(R.drawable.ic_arrow_down, tint = Palette.Blue, size = 16.dp)
                            Text(formatBytes(b.down), style = MaterialTheme.typography.bodyMedium)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Ico(R.drawable.ic_arrow_up, tint = Palette.BlueLight, size = 16.dp)
                            Text(formatBytes(b.up), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AppsPanel(apps: List<AppTotal>) {
    val ctx = LocalContext.current
    Panel {
        Text("أكثر التطبيقات استهلاكًا", style = MaterialTheme.typography.titleMedium)
        if (apps.isEmpty()) {
            Spacer(Modifier.height(8.dp))
            Muted("تظهر أرقام كل تطبيق أثناء تشغيل التحديد. بدونه يسجّل سرعات إجمالي الجهاز فقط.")
            return@Panel
        }
        val max = apps.maxOf { it.total }.coerceAtLeast(1)
        apps.take(8).forEach { a ->
            Row(
                Modifier.fillMaxWidth().padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                AppIcon(AppInfo.packageFor(ctx, a.uid), 38.dp)
                Column(Modifier.weight(1f)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(AppInfo.label(ctx, a.uid), style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                        Text(formatBytes(a.total), style = MaterialTheme.typography.labelLarge)
                    }
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(50)).background(Palette.Track)) {
                        Box(
                            Modifier.fillMaxWidth((a.total.toFloat() / max).coerceIn(0.02f, 1f)).height(5.dp)
                                .clip(RoundedCornerShape(50)).background(Palette.Blue),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionButton(label: String, icon: Int, modifier: Modifier, danger: Boolean = false, onClick: () -> Unit) {
    val tint = if (danger) Palette.Warn else Palette.Blue
    Row(
        modifier.clip(RoundedCornerShape(16.dp)).background(Palette.Surface).clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Ico(icon, tint = tint, size = 18.dp)
        Text(label, style = MaterialTheme.typography.labelLarge, color = tint)
    }
}

private fun writeCsv(ctx: android.content.Context, db: UsageDb, uri: android.net.Uri) {
    runCatching {
        ctx.contentResolver.openOutputStream(uri)?.bufferedWriter(Charsets.UTF_8)?.use { w ->
            w.write("\uFEFF") // byte-order mark so Excel reads the Arabic app names correctly
            w.write("time,network,app,download_bytes,upload_bytes\n")
            val zone = ZoneId.systemDefault()
            val fmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.US)
            db.forEachRow(0, Long.MAX_VALUE / 120_000) { r ->
                val time = ZonedDateTime.ofInstant(Instant.ofEpochMilli(r.minute * 60_000), zone).format(fmt)
                val app = AppInfo.label(ctx, r.uid).replace("\"", "\"\"")
                w.write("$time,${if (r.net == 1) "mobile" else "wifi"},\"$app\",${r.down},${r.up}\n")
            }
        }
    }
}
