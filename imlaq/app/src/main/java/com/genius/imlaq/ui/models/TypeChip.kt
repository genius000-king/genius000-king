package com.genius.imlaq.ui.models

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import com.genius.imlaq.R
import com.genius.imlaq.designsystem.Chip
import com.genius.imlaq.designsystem.ImlaqIcons
import com.genius.imlaq.models.ModelType

internal val ModelType.icon: ImageVector
    get() = when (this) {
        ModelType.TEXT -> ImlaqIcons.Chat
        ModelType.VISION -> ImlaqIcons.Eye
        ModelType.IMAGE -> ImlaqIcons.Picture
        ModelType.VIDEO -> ImlaqIcons.Film
        ModelType.SPEECH_TO_TEXT -> ImlaqIcons.Mic
        ModelType.TEXT_TO_SPEECH -> ImlaqIcons.Speaker
        ModelType.EMBEDDING -> ImlaqIcons.Layers
        ModelType.UNKNOWN -> ImlaqIcons.Question
    }

internal val ModelType.label: Int
    get() = when (this) {
        ModelType.TEXT -> R.string.type_text
        ModelType.VISION -> R.string.type_vision
        ModelType.IMAGE -> R.string.type_image
        ModelType.VIDEO -> R.string.type_video
        ModelType.SPEECH_TO_TEXT -> R.string.type_stt
        ModelType.TEXT_TO_SPEECH -> R.string.type_tts
        ModelType.EMBEDDING -> R.string.type_embedding
        ModelType.UNKNOWN -> R.string.type_unknown
    }

/** One quiet hue per type, for when the badges are shown in colour. */
internal val ModelType.hue: Color
    get() = when (this) {
        ModelType.TEXT -> Color(0xFFE9E4D8)
        ModelType.VISION -> Color(0xFF7FB8F0)
        ModelType.IMAGE -> Color(0xFFC39BF2)
        ModelType.VIDEO -> Color(0xFFF08FA8)
        ModelType.SPEECH_TO_TEXT -> Color(0xFF6FD6C4)
        ModelType.TEXT_TO_SPEECH -> Color(0xFFE8B14F)
        ModelType.EMBEDDING -> Color(0xFFA9B0B8)
        ModelType.UNKNOWN -> Color(0xFF8A8A8A)
    }

/**
 * What a model does, in two words and an icon. Types this app can't run yet say so
 * ("قريبًا"), so nobody downloads 20 GB expecting a chat.
 */
@Composable
internal fun TypeChip(type: ModelType, modifier: Modifier = Modifier, colored: Boolean = false) {
    val name = stringResource(type.label)
    val text = if (type.runsToday || type == ModelType.UNKNOWN) name else stringResource(R.string.type_soon, name)
    Chip(text, modifier, icon = type.icon, tint = if (colored) type.hue else null, dim = type == ModelType.UNKNOWN)
}
