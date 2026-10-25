/*
 * Copyright 2026 عبد الله محمد الضبيبي
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.genius.tvhub.core.designsystem

import android.os.Build
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import kotlinx.coroutines.delay
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.dialog
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

enum class GlassEntrance { POP, SHEET, DRAWER }
val LocalInterfaceMotion = staticCompositionLocalOf { true }
private class OverlayEntry(val key: Any, val dismiss: () -> Unit, val entrance: GlassEntrance, val render: @Composable BoxScope.() -> Unit) {
    var active by mutableStateOf(true)
}
private class OverlayController { val entries = mutableStateListOf<OverlayEntry>() }
private val LocalOverlays = staticCompositionLocalOf<OverlayController?> { null }

/** Overlays live in the same window. Blur the actual page, including text, rather than only stone. */
@Composable
fun OverlayHost(content: @Composable () -> Unit) {
    if (LocalOverlays.current != null) { content(); return }
    val controller = remember { OverlayController() }
    val entries = controller.entries.toList()
    val c = Imlaq.colors
    CompositionLocalProvider(LocalOverlays provides controller) {
        Box(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().obscured(entries.isNotEmpty())) { content() }
            entries.forEachIndexed { index, entry ->
                key(entry.key) {
                    val covered = index != entries.lastIndex
                    val motion = LocalInterfaceMotion.current
                    var entered by remember { mutableStateOf(false) }
                    LaunchedEffect(entry.active) {
                        entered = entry.active
                        if (!entry.active) { if (motion) delay(180); controller.entries.remove(entry) }
                    }
                    val reveal by animateFloatAsState(if (entered) 1f else 0f, tween(if (motion) 180 else 0), label = "glass-reveal")
                    val side = if (LocalLayoutDirection.current == LayoutDirection.Rtl) 1f else -1f
                    Box(Modifier.fillMaxSize().obscured(covered || !entry.active).semantics { dialog() }) {
                        val blurred = Build.VERSION.SDK_INT >= 31 && LocalEffects.current == Effects.FULL
                        Box(Modifier.fillMaxSize().background(c.background.copy(alpha = if (blurred) 0.3f else 0.92f))
                            .graphicsLayer { alpha = reveal }
                            .clickable(remember { MutableInteractionSource() }, indication = null, onClick = entry.dismiss))
                        Box(Modifier.fillMaxSize().graphicsLayer {
                            alpha = reveal
                            when (entry.entrance) {
                                GlassEntrance.POP -> { scaleX = 0.965f + 0.035f * reveal; scaleY = scaleX }
                                GlassEntrance.SHEET -> translationY = (1f - reveal) * 32.dp.toPx()
                                GlassEntrance.DRAWER -> translationX = (1f - reveal) * 24.dp.toPx() * side
                            }
                        }) { entry.render(this) }
                    }
                }
            }
            BackHandler(entries.isNotEmpty()) { entries.lastOrNull()?.dismiss?.invoke() }
        }
    }
}

@Composable
private fun Modifier.obscured(value: Boolean): Modifier = if (!value) this else
    then(if (Build.VERSION.SDK_INT >= 31 && LocalEffects.current == Effects.FULL) Modifier.blur(18.dp) else Modifier.alpha(0.08f)).clearAndSetSemantics { }

/** Register a modal layer. Nested layers also blur the panel below them. */
@Composable
fun GlassLayer(onDismiss: () -> Unit, entrance: GlassEntrance = GlassEntrance.POP, content: @Composable BoxScope.() -> Unit) {
    val controller = LocalOverlays.current
    if (controller == null) { OverlayHost { GlassLayer(onDismiss, entrance, content) }; return }
    val key = remember { Any() }
    val currentContent by rememberUpdatedState(content)
    val currentDismiss by rememberUpdatedState(onDismiss)
    DisposableEffect(controller, key) {
        val entry = OverlayEntry(key, { currentDismiss() }, entrance, { currentContent() })
        controller.entries.add(entry)
        onDispose { entry.active = false }
    }
}
