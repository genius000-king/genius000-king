package io.nawah.linux.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/** One spacing scale, used everywhere. Four values are enough for this app. */
object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
}

/** Touch targets. Nothing interactive is smaller than [minTouch]. */
object Sizes {
    val minTouch = 48.dp
    val buttonHeight = 52.dp
    val screenPadding = 16.dp
    val cardCorner = 16.dp
}

val NawahShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(18.dp),
    extraLarge = RoundedCornerShape(24.dp),
)
