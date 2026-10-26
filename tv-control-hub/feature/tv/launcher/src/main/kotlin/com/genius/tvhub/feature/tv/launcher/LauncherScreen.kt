package com.genius.tvhub.feature.tv.launcher

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.genius.tvhub.core.designsystem.HubIcons
import com.genius.tvhub.core.designsystem.Imlaq
import com.genius.tvhub.core.designsystem.ImlaqIcons
import com.genius.tvhub.core.designsystem.LivingBackground
import com.genius.tvhub.core.designsystem.PillShape
import com.genius.tvhub.core.designsystem.glass
import com.genius.tvhub.core.designsystem.tvFocus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** The TV's safe margin from the screen edge. */
private val EDGE = 56.dp

/**
 * The TV's home. Time, your extensions, your space (the apps you chose) — and, one press down,
 * every app on the device. The background drifts and takes the colour of what you focus.
 */
@Composable
fun LauncherScreen(
    state: LauncherState,
    actions: LauncherActions,
    nowMillis: Long,
    modifier: Modifier = Modifier,
    initialDrawer: Boolean = false,
) {
    // The room starts lit by the first app in your space, so the home never looks dead.
    var glow by remember(state.space.firstOrNull()?.packageName) { mutableStateOf(state.space.firstOrNull()?.accent) }
    var glowAt by remember { mutableStateOf(Offset(0.5f, 0.8f)) }
    var drawer by remember { mutableStateOf(initialDrawer) }
    var menuFor by remember { mutableStateOf<LauncherApp?>(null) }
    var addOpen by remember { mutableStateOf(false) }
    val firstTile = remember { FocusRequester() }
    val a = state.appearance
    val onFocused: (LauncherApp, Offset) -> Unit = { app, at -> glow = app.accent; glowAt = at }

    LivingBackground(modifier, glow = glow, glowAt = glowAt, intensity = a.glow, motion = a.motion) {
        // Not composed under the drawer: hidden tiles that can still take focus would swallow
        // presses (Up from the drawer landed on an invisible dock).
        if (!drawer) Column(
            // No horizontal padding here: the dock needs the full width so the focus light is never clipped.
            Modifier.fillMaxSize().padding(top = 30.dp, bottom = 14.dp),
        ) {
            Box(Modifier.padding(horizontal = EDGE)) { TopRow(state, nowMillis, actions) }
            Spacer(Modifier.weight(1f))
            WidgetsRow(state, actions, Modifier.padding(horizontal = EDGE))
            Spacer(Modifier.height(10.dp))
            Text(stringResource(R.string.tv_my_space), style = MaterialTheme.typography.labelMedium, color = Imlaq.colors.faint, modifier = Modifier.padding(start = EDGE + 6.dp))
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(18.dp),
                contentPadding = PaddingValues(horizontal = EDGE, vertical = 26.dp),
                modifier = Modifier.onPreviewKeyEvent {
                    if (it.type == KeyEventType.KeyDown && it.key == Key.DirectionDown) { drawer = true; true } else false
                },
            ) {
                items(state.space, key = { it.packageName }) { app ->
                    AppTile(
                        app, a.iconSize.dock, a.labels,
                        onClick = { actions.launch(app) }, onLongClick = { menuFor = app }, onFocused = onFocused,
                        focusRequester = if (app == state.space.first()) firstTile else null,
                        framed = a.iconFrames,
                    )
                }
                item { AddTile(a.iconSize.dock, stringResource(R.string.tv_add_app), { addOpen = true }) { glow = null; glowAt = it } }
            }
            DownHint(Modifier.align(Alignment.CenterHorizontally))
        }

        AnimatedVisibility(
            visible = drawer,
            enter = slideInVertically(spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessLow)) { it / 3 } + fadeIn(tween(220)),
            exit = slideOutVertically(tween(220)) { it / 3 } + fadeOut(tween(160)),
        ) {
            AppsDrawer(state, actions, onFocused, onLongClick = { menuFor = it }, onClose = { drawer = false })
        }
    }

    LaunchedEffect(state.space.isNotEmpty(), drawer) { if (state.space.isNotEmpty() && !drawer) runCatching { firstTile.requestFocus() } }
    BackHandler(drawer) { drawer = false }
    menuFor?.let { app -> AppMenu(app, inSpace = state.space.any { it.packageName == app.packageName }, actions) { menuFor = null } }
    if (addOpen) AddAppSheet(actions) { addOpen = false }
}

@Composable
private fun TopRow(state: LauncherState, nowMillis: Long, actions: LauncherActions) {
    val c = Imlaq.colors
    // From the configuration: a language switch in TV Hub re-reads it.
    val locale = androidx.compose.ui.platform.LocalConfiguration.current.locales[0]
    val date = Date(nowMillis)
    val hour = date.hours
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f)) {
            Text(
                stringResource(when (hour) { in 5..11 -> R.string.tv_good_morning; in 12..16 -> R.string.tv_good_afternoon; else -> R.string.tv_good_evening }),
                style = MaterialTheme.typography.titleMedium, color = c.muted,
            )
            Text(
                SimpleDateFormat(if (state.appearance.clock24h) "HH:mm" else "h:mm", Locale.US).format(date),
                fontSize = 74.sp, lineHeight = 80.sp, fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.headlineMedium.copy(textDirection = TextDirection.Ltr), color = c.text,
            )
            Text(SimpleDateFormat("EEEE d MMMM", locale).format(date), style = MaterialTheme.typography.bodyLarge, color = c.muted)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (state.pointerOn) StatusPill(HubIcons.Cursor, stringResource(R.string.tv_mouse_on))
            if (state.phoneName != null) StatusPill(HubIcons.Devices, state.phoneName, tint = c.ok)
            Icon(HubIcons.Wifi, null, tint = if (state.online) c.text else c.bad, modifier = Modifier.padding(horizontal = 6.dp).size(20.dp))
            Box(
                Modifier.size(48.dp).tvFocus(CircleShape).glass(CircleShape, strong = true).clickable { actions.openSettings() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(ImlaqIcons.Settings, stringResource(R.string.tv_settings), tint = c.text, modifier = Modifier.size(20.dp))
                // Setup is unfinished: a warm dot, nothing louder.
                if (state.setupStepsLeft > 0) Box(Modifier.align(Alignment.TopEnd).padding(9.dp).size(8.dp).background(c.warn, CircleShape))
            }
        }
    }
}

@Composable
private fun StatusPill(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, tint: Color? = null) {
    val c = Imlaq.colors
    Row(Modifier.glass(PillShape).padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, tint = tint ?: c.text, modifier = Modifier.size(16.dp))
        Text(text, style = MaterialTheme.typography.labelSmall, color = c.text, maxLines = 1)
    }
}

/** A chevron that bobs gently: there is more below. */
@Composable
private fun DownHint(modifier: Modifier) {
    val c = Imlaq.colors
    val t = rememberInfiniteTransition(label = "hint")
    val dy by t.animateFloat(0f, 5f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "dy")
    Row(modifier.padding(top = 4.dp).graphicsLayer { translationY = dy.dp.toPx() }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(HubIcons.ChevronDown, null, tint = c.faint, modifier = Modifier.size(16.dp))
        Text(stringResource(R.string.tv_all_apps_hint), style = MaterialTheme.typography.labelSmall, color = c.faint)
    }
}

@Composable
private fun AppsDrawer(
    state: LauncherState,
    actions: LauncherActions,
    onFocused: (LauncherApp, Offset) -> Unit,
    onLongClick: (LauncherApp) -> Unit,
    onClose: () -> Unit,
) {
    val c = Imlaq.colors
    val first = remember { FocusRequester() }
    val grid = rememberLazyGridState()
    var focusedIndex by remember { mutableStateOf(0) }
    Column(Modifier.fillMaxSize().padding(horizontal = EDGE, vertical = 36.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(stringResource(R.string.tv_all_apps), style = MaterialTheme.typography.headlineMedium, color = c.text)
            Text("${state.all.size}", style = MaterialTheme.typography.titleMedium, color = c.faint, modifier = Modifier.padding(bottom = 4.dp))
        }
        Spacer(Modifier.height(18.dp))
        LazyVerticalGrid(
            columns = GridCells.Adaptive((state.appearance.iconSize.grid + 44).dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
            state = grid,
            modifier = Modifier.onPreviewKeyEvent {
                if (it.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (it.key) {
                    Key.Back -> { onClose(); true }
                    // Up from the first row goes back home, the way Down came here.
                    Key.DirectionUp -> {
                        val row = grid.layoutInfo.visibleItemsInfo.firstOrNull { i -> i.index == focusedIndex }?.row
                        if (row == 0) { onClose(); true } else false
                    }
                    else -> false
                }
            },
        ) {
            itemsIndexed(state.all, key = { _, app -> app.packageName }) { index, app ->
                Box(contentAlignment = Alignment.Center) {
                    AppTile(app, state.appearance.iconSize.grid, true, { actions.launch(app) }, { onLongClick(app) }, { a, at -> focusedIndex = index; onFocused(a, at) }, focusRequester = if (app == state.all.firstOrNull()) first else null, framed = state.appearance.iconFrames)
                    if (!app.isTvApp) PhoneBadge(Modifier.align(Alignment.TopEnd))
                }
            }
        }
    }
    LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
}

/** Marks phone apps: they open with the pointer ready. */
@Composable
private fun PhoneBadge(modifier: Modifier) {
    val c = Imlaq.colors
    Box(modifier.padding(top = 2.dp, end = 10.dp).size(22.dp).glass(CircleShape, strong = true), contentAlignment = Alignment.Center) {
        Icon(ImlaqIcons.Phone, null, tint = c.muted, modifier = Modifier.size(12.dp))
    }
}
