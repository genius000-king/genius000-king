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

import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource

/** Floating panels share the app's glass, hairlines and capsule actions. */
@Composable
fun GlassDialog(
    title: String,
    onClose: () -> Unit,
    subtitle: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable () -> Unit,
) {
    val c = Imlaq.colors
    val maxHeight = (LocalConfiguration.current.screenHeightDp * 0.85f).dp
    GlassLayer(onClose) {
        CompositionLocalProvider(LocalBackdrop provides null) {
            Column(
                Modifier.align(Alignment.Center).imePadding().padding(20.dp).widthIn(max = 480.dp).fillMaxWidth()
                    .heightIn(max = maxHeight).glass(CardShape, strong = true).padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(title, style = MaterialTheme.typography.titleLarge, color = c.text)
                        if (!subtitle.isNullOrBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    IconCircle(ImlaqIcons.Close, stringResource(R.string.ds_close), onClick = onClose)
                }
                Box(Modifier.weight(1f, fill = false).fillMaxWidth()) { content() }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically, content = actions)
            }
        }
    }
}

/** Compact labels live inside a glass field rather than a Material outlined box. */
@Composable
fun CapsuleField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    lines: Int = 1,
    enabled: Boolean = true,
    visualTransformation: VisualTransformation = VisualTransformation.None,
) {
    val c = Imlaq.colors
    Column(modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), strong = true).padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = c.faint)
        BasicTextField(
            value = value, onValueChange = onValueChange, enabled = enabled,
            singleLine = lines == 1, minLines = lines, maxLines = if (lines == 1) 1 else 6,
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = if (enabled) c.text else c.muted, textDirection = TextDirection.Content, textAlign = TextAlign.Start),
            cursorBrush = SolidColor(c.text), visualTransformation = visualTransformation,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun GlassPopup(expanded: Boolean, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    if (expanded) GlassSheet(stringResource(R.string.ds_options), onDismiss) {
        Column(Modifier.fillMaxWidth(), content = content)
    }
}

@Composable
fun MenuRow(label: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = Imlaq.colors
    Row(
        modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, null, tint = if (enabled) c.muted else c.faint, modifier = Modifier.size(18.dp))
        Text(label, color = if (enabled) c.text else c.faint, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Attachment and filter panels rise from the bottom and never sit over the composer. */
@Composable
fun GlassSheet(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    GlassLayer(onClose, GlassEntrance.SHEET) {
        CompositionLocalProvider(LocalBackdrop provides null) {
            Column(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().imePadding().padding(12.dp)
                .widthIn(max = 560.dp).fillMaxWidth().glass(RoundedCornerShape(28.dp), strong = true).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Box(Modifier.align(Alignment.CenterHorizontally).width(36.dp).height(4.dp).clip(PillShape).background(Imlaq.colors.line))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, color = Imlaq.colors.text)
                    IconCircle(ImlaqIcons.Close, stringResource(R.string.ds_close), onClose)
                }
                content()
            }
        }
    }
}
