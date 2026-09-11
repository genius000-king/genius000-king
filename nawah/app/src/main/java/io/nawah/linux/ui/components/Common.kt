package io.nawah.linux.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.nawah.linux.core.model.Compatibility
import io.nawah.linux.ui.theme.NawahTheme
import io.nawah.linux.ui.theme.Spacing

/** A section title. Plain on purpose: the content is what matters. */
@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(top = Spacing.lg, bottom = Spacing.xs),
    )
}

/** A card the user picks from a list. Selection is a border, not a colour wash. */
@Composable
fun SelectableCard(
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val border = when {
        selected -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outlineVariant
    }
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = if (selected) MaterialTheme.colorScheme.surfaceVariant
        else MaterialTheme.colorScheme.surface,
        modifier = modifier
            .fillMaxWidth()
            .border(if (selected) 2.dp else 1.dp, border, MaterialTheme.shapes.medium)
            .clickable(enabled = enabled, onClick = onClick)
            .alpha(if (enabled) 1f else 0.45f),
    ) {
        Column(Modifier.padding(Spacing.md), content = content)
    }
}

/** The device-compatibility mark shown beside every distribution. */
@Composable
fun CompatBadge(verdict: Compatibility, modifier: Modifier = Modifier) {
    val colors = NawahTheme.status
    val (bg, fg, label) = when (verdict) {
        Compatibility.GOOD -> Triple(colors.goodContainer, colors.good, "Runs well")
        Compatibility.TIGHT -> Triple(colors.warnContainer, colors.warn, "Tight")
        Compatibility.BLOCKED -> Triple(colors.badContainer, colors.bad, "Not supported")
    }
    Box(
        modifier
            .background(bg, RoundedCornerShape(50))
            .padding(horizontal = Spacing.sm, vertical = 4.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = fg)
    }
}

/** One measured signal: "Memory — 6.0 GB". */
@Composable
fun SignalRow(label: String, detail: String, verdict: Compatibility) {
    val colors = NawahTheme.status
    Row(
        Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            detail,
            style = MaterialTheme.typography.bodySmall,
            color = when (verdict) {
                Compatibility.GOOD -> MaterialTheme.colorScheme.onSurface
                Compatibility.TIGHT -> colors.warn
                Compatibility.BLOCKED -> colors.bad
            },
            textAlign = TextAlign.End,
            modifier = Modifier.padding(start = Spacing.md),
        )
    }
}

/** "Step 2 of 4" plus a bar. No animation, no ceremony. */
@Composable
fun StepIndicator(step: Int, total: Int, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        Text(
            "Step $step of $total",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(Spacing.xs))
        LinearProgressIndicator(
            progress = { step.toFloat() / total },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** Monospace output pane for install logs and diagnostics. */
@Composable
fun LogPane(text: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small,
        modifier = modifier,
    ) {
        Box(Modifier.verticalScroll(rememberScrollState())) {
            Text(
                text = text.ifBlank { "…" },
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(Spacing.sm),
            )
        }
    }
}

/** A labelled switch with one plain line of explanation under it. */
@Composable
fun ExplainedSwitch(
    title: String,
    explanation: String,
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = Spacing.md)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(
                explanation,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
    }
}

/** Small neutral chip used for machine state. */
@Composable
fun StateChip(text: String, color: Color, container: Color) {
    Box(
        Modifier
            .background(container, RoundedCornerShape(50))
            .padding(horizontal = Spacing.sm, vertical = 2.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = color)
    }
}
