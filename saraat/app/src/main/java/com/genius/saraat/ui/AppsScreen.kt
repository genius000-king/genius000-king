package com.genius.saraat.ui

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.genius.saraat.Controller
import com.genius.saraat.R
import com.genius.saraat.data.AppEntry
import com.genius.saraat.data.AppInfo
import com.genius.saraat.data.AppMode
import com.genius.saraat.data.Prefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun AppsScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    var apps by remember { mutableStateOf<List<AppEntry>?>(null) }
    LaunchedEffect(Unit) { apps = withContext(Dispatchers.IO) { AppInfo.launchableApps(ctx) } }
    AppsContent(apps, onBack)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun AppsContent(apps: List<AppEntry>?, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val s by Prefs.state.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }

    val shown = apps.orEmpty().filter { query.isBlank() || it.label.contains(query.trim(), ignoreCase = true) }

    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Palette.Surface).clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                // The chevron points left; in right-to-left layouts "back" points right, so mirror it.
                Ico(R.drawable.ic_chevron, Modifier.scale(-1f, 1f), size = 20.dp)
            }
            Text("التطبيقات", style = MaterialTheme.typography.headlineMedium)
        }

        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip("كل التطبيقات", s.appMode == AppMode.ALL, { Controller.setAppSelection(ctx, AppMode.ALL, s.apps) })
            Chip("المحدد فقط", s.appMode == AppMode.ONLY, { Controller.setAppSelection(ctx, AppMode.ONLY, s.apps) })
            Chip("الكل ما عدا المحدد", s.appMode == AppMode.EXCEPT, { Controller.setAppSelection(ctx, AppMode.EXCEPT, s.apps) })
        }
        Spacer(Modifier.height(8.dp))
        Muted(
            when (s.appMode) {
                AppMode.ALL -> "الحد يطبَّق على كل تطبيقات الجهاز."
                AppMode.ONLY -> "الحد يطبَّق على التطبيقات المعلَّمة فقط. غيرها يعمل بأقصى سرعة."
                AppMode.EXCEPT -> "الحد يطبَّق على الجميع إلا التطبيقات المعلَّمة."
            },
        )
        Spacer(Modifier.height(10.dp))

        if (s.appMode != AppMode.ALL) {
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                singleLine = true,
                placeholder = { Text("ابحث عن تطبيق", style = MaterialTheme.typography.bodyMedium, color = Palette.Muted) },
                leadingIcon = { Ico(R.drawable.ic_search, tint = Palette.Muted, size = 20.dp) },
                shape = RoundedCornerShape(16.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Palette.Surface, unfocusedContainerColor = Palette.Surface,
                    focusedIndicatorColor = Palette.Blue, unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            if (apps == null) {
                Muted("جارٍ تحميل التطبيقات…")
            }
            LazyColumn(Modifier.fillMaxSize()) {
                items(shown, key = { it.packageName }) { app ->
                    val checked = app.packageName in s.apps
                    AppRow(app, checked) {
                        val next = if (checked) s.apps - app.packageName else s.apps + app.packageName
                        Controller.setAppSelection(ctx, s.appMode, next)
                    }
                }
            }
        }
    }
}

@Composable
private fun AppRow(app: AppEntry, checked: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(onClick = onToggle).padding(vertical = 8.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AppIcon(app.packageName, 42.dp)
        Text(app.label, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, maxLines = 1)
        Box(
            Modifier.size(26.dp).clip(CircleShape).background(if (checked) Palette.Blue else Color.White)
                .then(if (checked) Modifier else Modifier.background(Color.White)),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) Ico(R.drawable.ic_check, tint = Color.White, size = 16.dp)
            else Box(Modifier.size(26.dp).clip(CircleShape).background(Palette.Track).padding(2.dp).clip(CircleShape).background(Color.White))
        }
    }
}
