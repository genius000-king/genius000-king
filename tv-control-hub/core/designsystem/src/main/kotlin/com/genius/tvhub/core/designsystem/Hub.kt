package com.genius.tvhub.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** A glass panel that groups related content. Clickable when [onClick] is set. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .glass(CardShape)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

/** A hairline divider between rows in a card. */
@Composable
fun Hairline(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Imlaq.colors.line))
}

/** Label on one side, value on the other. Used for device facts. */
@Composable
fun KeyValueRow(label: String, value: String, modifier: Modifier = Modifier, valueColor: Color? = null) {
    val c = Imlaq.colors
    Row(modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = c.muted)
        Spacer(Modifier.width(12.dp))
        Text(value, style = MaterialTheme.typography.labelMedium.copy(textDirection = TextDirection.ContentOrLtr), color = valueColor ?: c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** A pill switch in the identity's materials: hairline track, cream knob when on. */
@Composable
fun PillSwitch(checked: Boolean, onCheckedChange: (Boolean) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = Imlaq.colors
    val knob by animateDpAsState(if (checked) 20.dp else 2.dp, tween(180), label = "knob")
    val track by animateColorAsState(if (checked) c.accent else Color.Transparent, tween(180), label = "track")
    Box(
        modifier
            .size(width = 46.dp, height = 28.dp)
            .clip(PillShape)
            .background(track, PillShape)
            .border(1.dp, if (checked) Color.Transparent else c.line, PillShape)
            .clickable(enabled = enabled, role = Role.Switch) { onCheckedChange(!checked) },
    ) {
        Box(
            Modifier
                .padding(start = knob, top = 3.dp)
                .size(22.dp)
                .background(if (checked) c.onAccent else c.muted, CircleShape),
        )
    }
}

/** A setting: title, optional explanation, and a switch. The whole row toggles. */
@Composable
fun ToggleRow(title: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit, modifier: Modifier = Modifier, subtitle: String? = null, enabled: Boolean = true) {
    val c = Imlaq.colors
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(CardShape)
            .clickable(enabled = enabled, role = Role.Switch) { onCheckedChange(!checked) }
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .semantics { stateDescription = if (checked) "on" else "off" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = if (enabled) c.text else c.faint)
            if (!subtitle.isNullOrBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted)
        }
        PillSwitch(checked, onCheckedChange, enabled = enabled)
    }
}

/**
 * One reading: icon, label, big value, optional track. When the reading does not exist on this
 * device, [unavailable] replaces the value with the reason, in the faint colour.
 */
@Composable
fun MetricTile(
    icon: ImageVector,
    label: String,
    value: String?,
    modifier: Modifier = Modifier,
    fraction: Float? = null,
    caption: String? = null,
    unavailable: String? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = Imlaq.colors
    GlassCard(modifier, onClick = onClick, padding = PaddingValues(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(icon, null, tint = c.muted, modifier = Modifier.size(16.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = c.muted, maxLines = 1)
        }
        Spacer(Modifier.height(10.dp))
        if (unavailable != null || value == null) {
            Text(stringResource(R.string.ds_unavailable), style = MaterialTheme.typography.titleMedium, color = c.faint)
            if (unavailable != null) Text(unavailable, style = MaterialTheme.typography.bodySmall, color = c.faint, maxLines = 2, overflow = TextOverflow.Ellipsis)
        } else {
            // "1.2 GB" must not become "GB 1.2" inside an Arabic layout.
            Text(value, style = MaterialTheme.typography.titleLarge.copy(textDirection = TextDirection.ContentOrLtr), color = c.text, maxLines = 1)
            if (caption != null) Text(caption, style = MaterialTheme.typography.bodySmall, color = c.muted, maxLines = 1)
            if (fraction != null) {
                Spacer(Modifier.height(10.dp))
                ProgressTrack(fraction)
            }
        }
    }
}

/** A thin live line of recent values, scaled to [max] (or to the data). No axes: the number says it. */
@Composable
fun Sparkline(values: List<Float>, modifier: Modifier = Modifier, max: Float? = null, color: Color? = null) {
    val c = Imlaq.colors
    val ink = color ?: c.text
    Canvas(modifier.fillMaxWidth().height(56.dp)) {
        if (values.size < 2) return@Canvas
        val top = (max ?: values.max()).coerceAtLeast(1e-6f)
        val step = size.width / (values.size - 1)
        val path = Path()
        values.forEachIndexed { i, v ->
            val x = i * step
            val y = size.height - (v / top).coerceIn(0f, 1f) * size.height
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawLine(c.line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
        drawPath(path, ink, style = Stroke(1.7.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** Centered icon, title, one line of text and at most one action. */
@Composable
fun EmptyState(icon: ImageVector, title: String, body: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}) {
    val c = Imlaq.colors
    Column(modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(56.dp).border(1.dp, c.line, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = c.muted, modifier = Modifier.size(24.dp))
        }
        Text(title, style = MaterialTheme.typography.titleMedium, color = c.text)
        Text(body, style = MaterialTheme.typography.bodyMedium, color = c.muted, modifier = Modifier.widthIn(max = 320.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        if (action != null) PillButton(action, onAction, small = true, modifier = Modifier.padding(top = 6.dp))
    }
}

/** A large square action: icon above a label. The phone home's quick actions. */
@Composable
fun ActionTile(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = Imlaq.colors
    Column(
        modifier
            .glass(CardShape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(vertical = 16.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon, null, tint = if (enabled) c.text else c.faint, modifier = Modifier.size(22.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = if (enabled) c.text else c.faint, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ---------------------------------------------------------------- TV

/**
 * Focus for the remote: the focused element grows 5% and gains a cream ring, so it is obvious
 * from the sofa. Pair with a clickable — Compose clickables already answer OK/Enter.
 */
@Composable
fun Modifier.tvFocus(shape: Shape = CardShape, onFocus: (Boolean) -> Unit = {}): Modifier {
    val c = Imlaq.colors
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.05f else 1f, tween(140), label = "tv-focus")
    return this
        .onFocusChanged { focused = it.isFocused || it.hasFocus; onFocus(focused) }
        .scale(scale)
        .border(if (focused) 2.dp else 0.dp, if (focused) c.text else Color.Transparent, shape)
}

/** A focusable glass tile for TV screens. */
@Composable
fun TvTile(onClick: () -> Unit, modifier: Modifier = Modifier, shape: Shape = CardShape, content: @Composable ColumnScope.() -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Column(
        modifier
            .tvFocus(shape)
            .glass(shape)
            .clickable(interaction, indication = null, role = Role.Button, onClick = onClick)
            .padding(18.dp),
        content = content,
    )
}

/** A round glass button for the few actions that must stay visible (back, home, more). */
@Composable
fun GlassOrb(icon: ImageVector, contentDescription: String, onClick: () -> Unit, modifier: Modifier = Modifier, size: Dp = 60.dp) {
    val c = Imlaq.colors
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.92f else 1f, androidx.compose.animation.core.spring(dampingRatio = 0.55f, stiffness = 600f), label = "orb")
    Box(
        modifier
            .size(size)
            .scale(scale)
            .glass(CircleShape, blur = ImlaqDimens.barBlur, strong = true)
            .clickable(interaction, indication = null, role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = c.text, modifier = Modifier.size(22.dp))
    }
}

/** A dot that breathes: something is in progress. */
@Composable
fun PulseDot(color: Color, modifier: Modifier = Modifier, size: Dp = 8.dp) {
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse")
    val a by t.animateFloat(0.35f, 1f, androidx.compose.animation.core.infiniteRepeatable(tween(800), androidx.compose.animation.core.RepeatMode.Reverse), label = "a")
    Box(modifier.size(size).background(color.copy(alpha = a), CircleShape))
}
