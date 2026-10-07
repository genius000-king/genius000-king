package com.genius.imlaq.ui.chat

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.StartOffset
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.genius.imlaq.R
import com.genius.imlaq.designsystem.Imlaq

/** How new words of a reply appear (picked in the motion lab). */
enum class TextReveal {
    /** Each new word fades in. */
    FADE,

    /** Words land at once; a thin caret sits at the end while the model writes. */
    CARET,

    /** New words arrive bright and cool down to the text colour. */
    GLOW,
}

/** What shows while the model reads the question, before its first word. */
enum class ThinkingLook { DOTS, SHIMMER, ORB }

/** The looks in use. One place, so the lab's answers land in one edit. */
object Motion {
    val textReveal = TextReveal.FADE
    val thinking = ThinkingLook.DOTS
}

private const val FADE_MS = 420L
private const val GLOW_MS = 1100L
private const val CARET = "caret"

/**
 * A reply that grows while the model writes. Text that was already there when this message
 * came on screen shows at once; only what arrives afterwards animates.
 */
@Composable
fun StreamingText(text: String, streaming: Boolean, reveal: TextReveal = Motion.textReveal) {
    val c = Imlaq.colors
    val style = MaterialTheme.typography.bodyLarge
    if (reveal == TextReveal.CARET) {
        val shown = buildAnnotatedString {
            append(text)
            if (streaming) appendInlineContent(CARET, "▍")
        }
        val caret = mapOf(
            CARET to InlineTextContent(Placeholder(0.4.em, 1.1.em, PlaceholderVerticalAlign.TextCenter)) {
                Box(Modifier.fillMaxHeight(), contentAlignment = Alignment.CenterEnd) {
                    Box(Modifier.width(2.dp).fillMaxHeight().background(c.text))
                }
            },
        )
        Text(shown, style = style, color = c.text, inlineContent = caret)
        return
    }

    // Where each burst of new text starts, and when it arrived (frame clock, ms).
    val arrivals = remember { mutableStateListOf<Pair<Int, Long>>() }
    var known by remember { mutableLongStateOf(text.length.toLong()) }
    var clock by remember { mutableLongStateOf(0L) }
    val duration = if (reveal == TextReveal.GLOW) GLOW_MS else FADE_MS

    LaunchedEffect(text.length) {
        val now = withFrameMillis { it }
        clock = now
        if (text.length < known) arrivals.clear()
        else if (text.length > known) arrivals += known.toInt() to now
        known = text.length.toLong()
        // Run the clock only while something is still animating, then drop finished bursts.
        while (arrivals.isNotEmpty()) {
            clock = withFrameMillis { it }
            val done = arrivals.takeWhile { clock - it.second >= duration }.size
            // A finished burst joins the plain text before the first mark.
            if (done > 0) arrivals.removeRange(0, done)
        }
    }

    val shown = buildAnnotatedString {
        val marks = arrivals.toList().filter { it.first < text.length }
        append(text.substring(0, marks.firstOrNull()?.first ?: text.length))
        marks.forEachIndexed { i, (start, at) ->
            val end = marks.getOrNull(i + 1)?.first ?: text.length
            val p = ((clock - at).toFloat() / duration).coerceIn(0f, 1f)
            val span = when (reveal) {
                TextReveal.GLOW -> SpanStyle(
                    color = lerp(Color.White, c.text, p),
                    shadow = Shadow(Color(0xFFFFECC8).copy(alpha = 0.85f * (1f - p)), Offset.Zero, 14f * (1f - p)),
                )
                else -> SpanStyle(color = c.text.copy(alpha = c.text.alpha * p))
            }
            withStyle(span) { append(text.substring(start, end)) }
        }
    }
    Text(shown, style = style, color = c.text)
}

/** Shown in place of the reply until its first word. */
@Composable
fun ThinkingIndicator(look: ThinkingLook = Motion.thinking) {
    val c = Imlaq.colors
    val transition = rememberInfiniteTransition(label = "thinking")
    Box(Modifier.height(28.dp), contentAlignment = Alignment.CenterStart) {
        when (look) {
            ThinkingLook.DOTS -> Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat(3) { i ->
                    val a by transition.animateFloat(
                        initialValue = 0.25f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(tween(480), RepeatMode.Reverse, StartOffset(i * 160)),
                        label = "dot$i",
                    )
                    Box(Modifier.size(7.dp).scale(0.8f + 0.2f * a).alpha(a).background(c.text, CircleShape))
                }
            }
            ThinkingLook.SHIMMER -> {
                val x by transition.animateFloat(
                    initialValue = 1f,
                    targetValue = -0.5f,
                    animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing)),
                    label = "sweep",
                )
                val w = 260f
                val brush = Brush.linearGradient(
                    0f to c.faint, 0.4f to c.faint, 0.5f to Color.White, 0.6f to c.faint, 1f to c.faint,
                    start = Offset(x * w * 2, 0f),
                    end = Offset(x * w * 2 + w, 0f),
                )
                Text(stringResource(R.string.chat_thinking), style = MaterialTheme.typography.bodyLarge.copy(brush = brush))
            }
            ThinkingLook.ORB -> {
                val b by transition.animateFloat(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
                    label = "breath",
                )
                Box(
                    Modifier
                        .size(14.dp)
                        .scale(0.7f + 0.3f * b)
                        .shadow((10 * b).dp, CircleShape, ambientColor = c.text, spotColor = c.text)
                        .alpha(0.55f + 0.45f * b)
                        .background(c.text, CircleShape),
                )
            }
        }
    }
}
