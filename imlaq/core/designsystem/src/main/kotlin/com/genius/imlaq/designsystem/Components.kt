package com.genius.imlaq.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect

val PillShape = RoundedCornerShape(percent = 50)
val CardShape = RoundedCornerShape(ImlaqDimens.cardRadius)

/**
 * Frosted glass: the backdrop behind this element blurred by [blur], a translucent fill over
 * it, and a hairline border. Where blur is unavailable (before Android 12) Haze draws the
 * stronger fill alone, so text stays readable.
 */
@Composable
fun Modifier.glass(shape: Shape, blur: Dp = ImlaqDimens.cardBlur, strong: Boolean = false): Modifier {
    val c = Imlaq.colors
    val backdrop = LocalBackdrop.current
    val fill = if (strong) c.glassHi else c.glass
    val base = clip(shape)
    val glassed = if (backdrop != null) {
        base.hazeEffect(
            backdrop,
            HazeStyle(
                backgroundColor = c.background,
                tints = listOf(HazeTint(fill)),
                blurRadius = blur,
                noiseFactor = 0f,
                fallbackTint = HazeTint(c.glassHi),
            ),
        )
    } else {
        base.background(fill, shape)
    }
    return glassed.border(1.dp, c.line, shape)
}

@Composable
private fun Modifier.pressable(enabled: Boolean, onClick: () -> Unit): Modifier {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    return scale(if (pressed) 0.97f else 1f)
        .clickable(interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
}

/** The main action: a solid cream pill (ink in the light theme), 52 dp tall. */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    small: Boolean = false,
) {
    val c = Imlaq.colors
    val height = if (small) ImlaqDimens.smallButtonHeight else ImlaqDimens.buttonHeight
    Row(
        modifier
            .defaultMinSize(minHeight = height)
            .clip(PillShape)
            .background(if (enabled) c.accent else c.accent.copy(alpha = 0.35f), PillShape)
            .pressable(enabled, onClick)
            .padding(horizontal = if (small) 18.dp else 26.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = c.onAccent, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = if (small) MaterialTheme.typography.labelMedium else MaterialTheme.typography.labelLarge, color = c.onAccent)
    }
}

/** The secondary action: transparent pill with a hairline. */
@Composable
fun GhostButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    small: Boolean = true,
    color: Color? = null,
) {
    val c = Imlaq.colors
    val height = if (small) ImlaqDimens.smallButtonHeight else ImlaqDimens.buttonHeight
    val ink = color ?: if (enabled) c.text else c.faint
    Row(
        modifier
            .defaultMinSize(minHeight = height)
            .clip(PillShape)
            .border(1.dp, c.line, PillShape)
            .pressable(enabled, onClick)
            .padding(horizontal = if (small) 16.dp else 26.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = ink, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = ink)
    }
}

/** A round hairline button for one icon (theme toggle, delete). */
@Composable
fun IconCircle(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    filled: Boolean = false,
    enabled: Boolean = true,
    tint: Color? = null,
) {
    val c = Imlaq.colors
    Box(
        modifier
            .size(ImlaqDimens.smallButtonHeight)
            .clip(CircleShape)
            .then(if (filled) Modifier.background(if (enabled) c.accent else c.accent.copy(alpha = 0.35f), CircleShape) else Modifier.border(1.dp, c.line, CircleShape))
            .pressable(enabled, onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = tint ?: if (filled) c.onAccent else c.text,
            modifier = Modifier.size(18.dp),
        )
    }
}

/** Two or three options in one hairline pill; the selected one is solid. */
@Composable
fun SegmentedTabs(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Row(
        modifier.clip(PillShape).border(1.dp, c.line, PillShape).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        options.forEachIndexed { i, label ->
            val on = i == selected
            Box(
                Modifier
                    .clip(PillShape)
                    .background(if (on) c.accent else Color.Transparent, PillShape)
                    .clickable(role = Role.Tab) { onSelect(i) }
                    .padding(horizontal = 14.dp, vertical = 6.dp),
            ) {
                Text(label, style = MaterialTheme.typography.labelMedium, color = if (on) c.onAccent else c.muted)
            }
        }
    }
}

/** The floating glass bar at the top of every screen. */
@Composable
fun GlassTopBar(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Row(
        modifier
            .fillMaxWidth()
            .glass(PillShape, blur = ImlaqDimens.barBlur)
            .padding(start = 16.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/** "● label" — state in a colour and a word. */
@Composable
fun StatusDot(text: String, color: Color, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).background(color, CircleShape))
        Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = Imlaq.colors.muted)
    }
}

/** A 5 dp progress track. */
@Composable
fun ProgressTrack(fraction: Float, modifier: Modifier = Modifier) {
    val c = Imlaq.colors
    Box(modifier.fillMaxWidth().height(5.dp).clip(PillShape).background(c.line)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(5.dp).clip(PillShape).background(c.text))
    }
}

/**
 * A one-line glass capsule to type in (search, a link), with an action at its end.
 * The chat composer is the same shape with room for several lines.
 */
@Composable
fun GlassField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    leading: ImageVector? = null,
    keyboardOptions: androidx.compose.foundation.text.KeyboardOptions = androidx.compose.foundation.text.KeyboardOptions.Default,
    keyboardActions: androidx.compose.foundation.text.KeyboardActions = androidx.compose.foundation.text.KeyboardActions.Default,
    trailing: @Composable RowScope.() -> Unit = {},
) {
    val c = Imlaq.colors
    Row(
        modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = ImlaqDimens.buttonHeight)
            .glass(PillShape, blur = ImlaqDimens.barBlur, strong = true)
            .padding(start = 16.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (leading != null) Icon(leading, contentDescription = null, tint = c.faint, modifier = Modifier.size(18.dp))
        androidx.compose.foundation.text.BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.text),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(c.text),
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            modifier = Modifier.weight(1f),
            decorationBox = { field ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) Text(placeholder, style = MaterialTheme.typography.bodyLarge, color = c.faint, maxLines = 1)
                    field()
                }
            },
        )
        trailing()
    }
}

/**
 * A small hairline label with an icon, for what a thing is (a model's type). [tint] colours the
 * icon and border; without it the chip stays in the text colour like everything else.
 */
@Composable
fun Chip(text: String, modifier: Modifier = Modifier, icon: ImageVector? = null, tint: Color? = null, dim: Boolean = false) {
    val c = Imlaq.colors
    val ink = when {
        dim -> c.faint
        tint != null -> tint
        else -> c.muted
    }
    Row(
        modifier
            .clip(PillShape)
            .border(1.dp, if (tint != null && !dim) tint.copy(alpha = 0.45f) else c.line, PillShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = ink, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text, style = MaterialTheme.typography.labelSmall, color = if (dim) c.faint else c.text.copy(alpha = 0.86f), maxLines = 1)
    }
}
