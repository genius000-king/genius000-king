package com.genius.imlaq.designsystem

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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

val PillShape = RoundedCornerShape(percent = 50)
val CardShape = RoundedCornerShape(28.dp)

/** A faint fill plus a hairline border: the "glass" every panel in the app is made of. */
@Composable
fun Modifier.glass(shape: Shape, strong: Boolean = false): Modifier {
    val c = Imlaq.colors
    return this
        .clip(shape)
        .background(if (strong) c.glassStrong else c.glass, shape)
        .border(1.dp, c.hairline, shape)
}

@Composable
private fun Modifier.pressScale(interaction: MutableInteractionSource): Modifier {
    val pressed by interaction.collectIsPressedAsState()
    return scale(if (pressed) 0.97f else 1f)
}

/** The one thing to press on a screen: solid cream (ink in the light theme). */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leading: (@Composable () -> Unit)? = null,
) {
    val c = Imlaq.colors
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier
            .pressScale(interaction)
            .clip(PillShape)
            .background(if (enabled) c.accent else c.accent.copy(alpha = 0.35f), PillShape)
            .clickable(interaction, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = 28.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(10.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, color = c.onAccent)
    }
}

/** The secondary action: transparent, hairline outline. */
@Composable
fun GhostPillButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = Imlaq.colors
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier
            .pressScale(interaction)
            .clip(PillShape)
            .border(1.dp, c.hairline, PillShape)
            .clickable(interaction, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = 28.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            style = MaterialTheme.typography.labelLarge,
            color = if (enabled) c.textPrimary else c.textMuted,
        )
    }
}

/** A round glass button for a single icon (the theme toggle in the top bar). */
@Composable
fun IconCircleButton(onClick: () -> Unit, modifier: Modifier = Modifier, size: Dp = 46.dp, icon: @Composable () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier
            .size(size)
            .pressScale(interaction)
            .glass(CircleShape, strong = true)
            .clickable(interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { icon() }
}

/** The floating pill header: brand at the start, actions at the end. */
@Composable
fun FloatingTopBar(
    modifier: Modifier = Modifier,
    brand: @Composable RowScope.() -> Unit,
    actions: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier
            .fillMaxWidth()
            .glass(PillShape, strong = true)
            .padding(start = 18.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, content = brand)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

/** "● available for new projects" — a status line inside a hairline pill. */
@Composable
fun StatusChip(text: String, dot: Color, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Row(
        modifier
            .clip(PillShape)
            .border(1.dp, c.hairline, PillShape)
            .padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(9.dp).background(dot, CircleShape))
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
    }
}

/** A large glass card with an optional eyebrow label. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    eyebrow: String? = null,
    contentPadding: PaddingValues = PaddingValues(24.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier.fillMaxWidth().glass(CardShape).padding(contentPadding)) {
        if (eyebrow != null) {
            Text(eyebrow, style = MaterialTheme.typography.labelMedium, color = Imlaq.colors.textMuted)
            Spacer(Modifier.height(14.dp))
        }
        content()
    }
}

/** The two-tone headline: first line bright, second line dimmed, centred. */
@Composable
fun HeroTitle(primary: String, secondary: String, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(primary, style = MaterialTheme.typography.displayLarge, color = c.textPrimary, textAlign = TextAlign.Center)
        Text(secondary, style = MaterialTheme.typography.displayLarge, color = c.textMuted, textAlign = TextAlign.Center)
    }
}

/** Section heading: small muted eyebrow over a bold title. */
@Composable
fun SectionHeader(eyebrow: String, title: String, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Column(modifier.fillMaxWidth()) {
        Text(eyebrow, style = MaterialTheme.typography.labelMedium, color = c.textMuted)
        Spacer(Modifier.height(6.dp))
        Text(title, style = MaterialTheme.typography.headlineMedium, color = c.textPrimary)
    }
}

/** One "label …… value" row inside a card. */
@Composable
fun StatRow(label: String, value: String, modifier: Modifier = Modifier, valueColor: Color? = null) {
    val c = Imlaq.colors
    Row(modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = valueColor ?: c.textPrimary)
    }
}

/** A thin bar for "how much of X is used". */
@Composable
fun UsageBar(fraction: Float, modifier: Modifier = Modifier, color: Color? = null) {
    val c = Imlaq.colors
    val fill = color ?: c.accent
    Box(modifier.fillMaxWidth().height(6.dp).clip(PillShape).background(c.glassStrong)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(PillShape).background(fill))
    }
}

/** A small hairline tag ("MoE", "كثيف", …). */
@Composable
fun Tag(text: String, modifier: Modifier = Modifier, color: Color? = null) {
    val c = Imlaq.colors
    Box(
        modifier
            .clip(PillShape)
            .border(1.dp, (color ?: c.hairline).copy(alpha = if (color != null) 0.6f else 1f), PillShape)
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = color ?: c.textSecondary)
    }
}

// ── icons drawn in code (no icon font, no image assets) ──

@Composable
fun SunIcon(modifier: Modifier = Modifier.size(20.dp), color: Color = Imlaq.colors.textPrimary) {
    Canvas(modifier) {
        val r = size.minDimension / 2
        val center = Offset(size.width / 2, size.height / 2)
        drawCircle(color, radius = r * 0.36f, center = center, style = Stroke(width = r * 0.14f))
        repeat(8) { i ->
            val a = Math.toRadians(i * 45.0)
            val start = Offset(center.x + (r * 0.62f * cos(a)).toFloat(), center.y + (r * 0.62f * sin(a)).toFloat())
            val end = Offset(center.x + (r * 0.92f * cos(a)).toFloat(), center.y + (r * 0.92f * sin(a)).toFloat())
            drawLine(color, start, end, strokeWidth = r * 0.14f, cap = StrokeCap.Round)
        }
    }
}

@Composable
fun MoonIcon(modifier: Modifier = Modifier.size(20.dp), color: Color = Imlaq.colors.textPrimary) {
    Canvas(modifier) {
        val r = size.minDimension / 2
        val cx = size.width / 2
        val cy = size.height / 2
        val disc = Path().apply { addOval(Rect(Offset(cx, cy), r * 0.78f)) }
        val bite = Path().apply { addOval(Rect(Offset(cx + r * 0.42f, cy - r * 0.32f), r * 0.62f)) }
        drawPath(Path().apply { op(disc, bite, PathOperation.Difference) }, color)
    }
}

/** The brand mark: the letter ع inside a ring. */
@Composable
fun BrandMark(modifier: Modifier = Modifier, size: Dp = 34.dp) {
    val c = Imlaq.colors
    Box(
        modifier.size(size).border(1.5.dp, c.textPrimary, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text("ع", style = MaterialTheme.typography.titleMedium, color = c.textPrimary)
    }
}
