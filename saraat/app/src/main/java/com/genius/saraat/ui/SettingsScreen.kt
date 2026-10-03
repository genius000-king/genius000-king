package com.genius.saraat.ui

import android.content.Intent
import android.provider.Settings as AndroidSettings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.saraat.Controller
import com.genius.saraat.R
import com.genius.saraat.data.Prefs

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen() {
    val ctx = LocalContext.current
    val s by Prefs.state.collectAsStateWithLifecycle()

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("الإعدادات", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.headlineMedium)

        Panel {
            ToggleRow(
                R.drawable.ic_zap, "تحديد أدق للمتصفحات",
                "يمنع بروتوكول QUIC ليستخدم يوتيوب وكروم TCP فيلتزمان بالحد بدقة.",
                s.blockQuic, { Controller.setBlockQuic(ctx, it) },
            )
        }

        Panel {
            ToggleRow(
                R.drawable.ic_bars, "تسجيل الاستهلاك في الخلفية",
                "يسجّل ما تستهلكه كل دقيقة حتى لو كان التحديد متوقفًا (إشعار صغير دائم).",
                s.keepLogging, { Controller.setKeepLogging(ctx, it) },
            )
            Spacer(Modifier.height(16.dp))
            ToggleRow(
                R.drawable.ic_power, "التشغيل عند إقلاع الجهاز",
                "يعيد المراقبة والتحديد تلقائيًا بعد إعادة التشغيل.",
                s.bootStart, { v -> Prefs.update { copy(bootStart = v) } },
            )
        }

        Panel {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconBadge(R.drawable.ic_clock)
                Column(Modifier.weight(1f)) {
                    Text("مدة حفظ السجل", style = MaterialTheme.typography.bodyLarge)
                    Muted("القديم يُحذف تلقائيًا")
                }
            }
            Spacer(Modifier.height(12.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(7 to "7 أيام", 30 to "30 يومًا", 90 to "90 يومًا").forEach { (days, label) ->
                    Chip(label, s.retentionDays == days, { Prefs.update { copy(retentionDays = days) } })
                }
            }
        }

        Panel(onClick = {
            ctx.startActivity(Intent(AndroidSettings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconBadge(R.drawable.ic_battery)
                Column(Modifier.weight(1f)) {
                    Text("استثناء من توفير البطارية", style = MaterialTheme.typography.bodyLarge)
                    Muted("بعض الهواتف توقف التطبيقات في الخلفية. استثنِ سرعات حتى يستمر التسجيل.")
                }
                Ico(R.drawable.ic_chevron, tint = Palette.Muted)
            }
        }

        Panel {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconBadge(R.drawable.ic_info)
                Text("ما يجب أن تعرفه", style = MaterialTheme.typography.bodyLarge)
            }
            Spacer(Modifier.height(10.dp))
            Muted(
                "• سرعات يقلل السرعة عبر VPN محلي داخل جوالك: لا يمر شيء بخوادم خارجية.\n" +
                    "• الحد يطبَّق على الاتصالات المارّة عبر IPv4. مواقع IPv6 فقط قد لا تفتح أثناء التحديد.\n" +
                    "• اكتشاف الأجهزة المحلية (مثل Chromecast) لا يعمل أثناء التحديد؛ استعمل خيار «المحدد فقط».\n" +
                    "• قد يظهر لك تطبيق VPN آخر أنه فُصل: أندرويد يسمح بـVPN واحد في الوقت نفسه.",
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}
