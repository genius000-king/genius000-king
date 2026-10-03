package com.genius.saraat.ui

import android.content.Context
import android.util.LruCache
import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import androidx.compose.material3.Icon
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun Ico(@DrawableRes id: Int, modifier: Modifier = Modifier, tint: Color = Palette.Ink, size: Dp = 22.dp) {
    Icon(painterResource(id), contentDescription = null, modifier = modifier.size(size), tint = tint)
}

/** Flat rounded surface used for every block of content. */
@Composable
fun Panel(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(22.dp)
    val base = modifier.fillMaxWidth().clip(shape).background(Palette.Surface)
    Column(
        (if (onClick != null) base.clickable(onClick = onClick) else base).padding(16.dp),
        content = content,
    )
}

@Composable
fun Chip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier
            .clip(shape)
            .background(if (selected) Palette.Blue else Color.White)
            .border(1.dp, if (selected) Palette.Blue else Palette.Outline, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) Color.White else Palette.Ink,
        )
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier.padding(top = 4.dp), style = MaterialTheme.typography.titleMedium)
}

@Composable
fun IconBadge(@DrawableRes icon: Int, tint: Color = Palette.Blue, background: Color = Palette.BlueSoft) {
    Box(Modifier.size(38.dp).clip(CircleShape).background(background), contentAlignment = Alignment.Center) {
        Ico(icon, tint = tint, size = 20.dp)
    }
}

@Composable
fun ToggleRow(
    @DrawableRes icon: Int,
    title: String,
    subtitle: String?,
    checked: Boolean,
    onChecked: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().clickable { onChecked(!checked) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        IconBadge(icon)
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (subtitle != null) Muted(subtitle)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChecked,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Palette.Blue,
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = Palette.BlueLight.copy(alpha = 0.45f),
                uncheckedBorderColor = Color.Transparent,
                checkedBorderColor = Color.Transparent,
            ),
        )
    }
}

/** Filled area under a thin line: the last minute of speed at a glance. */
@Composable
fun Sparkline(values: List<Float>, modifier: Modifier = Modifier, color: Color = Palette.Blue) {
    Canvas(modifier) {
        if (values.size < 2) return@Canvas
        val max = (values.maxOrNull() ?: 0f).coerceAtLeast(1f)
        val stepX = size.width / (values.size - 1)
        val line = Path()
        val area = Path()
        values.forEachIndexed { i, v ->
            val x = i * stepX
            val y = size.height - (v / max) * (size.height - 4.dp.toPx()) - 2.dp.toPx()
            if (i == 0) {
                line.moveTo(x, y)
                area.moveTo(x, size.height)
                area.lineTo(x, y)
            } else {
                line.lineTo(x, y)
                area.lineTo(x, y)
            }
        }
        area.lineTo(size.width, size.height)
        area.close()
        drawPath(area, Brush.verticalGradient(listOf(color.copy(alpha = 0.28f), color.copy(alpha = 0f))))
        drawPath(line, color, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
    }
}

/** Small cache so scrolling a long app list does not decode icons again and again. */
object IconCache {
    private val cache = LruCache<String, ImageBitmap>(160)

    fun load(context: Context, pkg: String): ImageBitmap? {
        cache.get(pkg)?.let { return it }
        return try {
            context.packageManager.getApplicationIcon(pkg).toBitmap(96, 96).asImageBitmap().also { cache.put(pkg, it) }
        } catch (_: Exception) {
            null
        }
    }
}

@Composable
fun AppIcon(pkg: String?, size: Dp = 40.dp) {
    val ctx = LocalContext.current
    val bmp by produceState<ImageBitmap?>(null, pkg) {
        value = if (pkg == null) null else withContext(Dispatchers.IO) { IconCache.load(ctx, pkg) }
    }
    val shape = RoundedCornerShape(11.dp)
    val image = bmp
    if (image != null) {
        Image(image, null, Modifier.size(size).clip(shape))
    } else {
        Box(Modifier.size(size).clip(shape).background(Palette.Track), contentAlignment = Alignment.Center) {
            Ico(com.genius.saraat.R.drawable.ic_phone, tint = Palette.Muted, size = size / 2)
        }
    }
}

