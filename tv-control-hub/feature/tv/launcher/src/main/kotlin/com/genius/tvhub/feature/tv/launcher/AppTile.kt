package com.genius.tvhub.feature.tv.launcher

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.glass

/**
 * An app on the TV: its icon on a glass squircle. Focused, it rises on a spring and reports where
 * it is, so the living background lights the room in the app's colour around it.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AppTile(
    app: LauncherApp,
    iconDp: Int,
    showLabel: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onFocused: (LauncherApp, Offset) -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    framed: Boolean = false,
) {
    val c = Imlaq.colors
    var focused by remember { mutableStateOf(false) }
    var center by remember { mutableStateOf(Offset(0.5f, 0.5f)) }
    val window = LocalWindowInfo.current.containerSize
    val scale by animateFloatAsState(if (focused) 1.14f else 1f, spring(dampingRatio = 0.62f, stiffness = Spring.StiffnessMediumLow), label = "tile")
    val ring by animateColorAsState(if (focused) c.text.copy(alpha = 0.9f) else c.line, tween(160), label = "ring")
    val shape = RoundedCornerShape((iconDp * 0.28f).dp)
    val interaction = remember { MutableInteractionSource() }

    Column(
        modifier
            .width((iconDp + 28).dp)
            .onGloballyPositioned {
                val b = it.boundsInRoot()
                if (window.width > 0) center = Offset(b.center.x / window.width, b.center.y / window.height)
            }
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .onFocusChanged { f -> focused = f.isFocused; if (f.isFocused) onFocused(app, center) }
            .combinedClickable(interaction, indication = null, role = Role.Button, onClick = onClick, onLongClick = onLongClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .graphicsLayer { scaleX = scale; scaleY = scale; translationY = if (focused) -6.dp.toPx() else 0f }
                .size(iconDp.dp)
                .then(
                    if (framed) Modifier.glass(shape, strong = true).border(if (focused) 2.dp else 1.dp, ring, shape)
                    // Unframed: the app's own icon, and a cream ring only around the focused one.
                    else Modifier.border(2.dp, if (focused) c.text.copy(alpha = 0.9f) else Color.Transparent, shape),
                ),
            contentAlignment = Alignment.Center,
        ) {
            val inner = if (framed) iconDp * 0.66f else iconDp - 12f
            if (app.icon != null) {
                Image(app.icon, app.label, Modifier.size(inner.dp).clip(RoundedCornerShape((inner * 0.26f).dp)))
            } else {
                Box(Modifier.size(inner.dp).clip(RoundedCornerShape((inner * 0.26f).dp)).background(app.accent), contentAlignment = Alignment.Center) {
                    Text(app.label.take(1), style = MaterialTheme.typography.titleLarge, color = Color.White)
                }
            }
        }
        if (showLabel || focused) {
            Spacer(Modifier.height(if (focused) 14.dp else 10.dp))
            Text(
                app.label,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Medium),
                color = if (focused) c.text else c.muted,
                maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
            )
        }
    }
}

/** The "+" at the end of the dock. */
@Composable
fun AddTile(iconDp: Int, label: String, onClick: () -> Unit, onFocused: (Offset) -> Unit) {
    val c = Imlaq.colors
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.12f else 1f, spring(dampingRatio = 0.62f), label = "add")
    val shape = RoundedCornerShape((iconDp * 0.28f).dp)
    Column(
        Modifier.width((iconDp + 28).dp)
            .onFocusChanged { focused = it.isFocused; if (it.isFocused) onFocused(Offset(0.85f, 0.7f)) }
            .combinedClickableCompat(onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top,
    ) {
        Box(
            Modifier.graphicsLayer { scaleX = scale; scaleY = scale }.size(iconDp.dp).clip(shape)
                .border(if (focused) 2.dp else 1.dp, if (focused) c.text else c.line, shape),
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.material3.Icon(com.genius.tvhub.core.designsystem.ImlaqIcons.Plus, label, tint = if (focused) c.text else c.muted, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.height(10.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = if (focused) c.text else c.faint, maxLines = 1)
    }
}

@OptIn(ExperimentalFoundationApi::class)
private fun Modifier.combinedClickableCompat(onClick: () -> Unit) =
    this.then(Modifier.combinedClickable(interactionSource = null, indication = null, role = Role.Button, onClick = onClick))
