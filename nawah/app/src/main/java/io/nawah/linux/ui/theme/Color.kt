package io.nawah.linux.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * The whole palette derives from three brand colours and a warm neutral ramp.
 * Nothing here is imported from a stock Material palette.
 *
 *   Merino      #F5EEDD  paper
 *   Rock Blue   #84B3CE  accent
 *   Venice Blue #16587B  ink
 */

// --- Brand ------------------------------------------------------------------

val Merino = Color(0xFFF5EEDD)
val RockBlue = Color(0xFF84B3CE)
val VeniceBlue = Color(0xFF16587B)

// --- Merino ramp (warm paper neutrals) --------------------------------------

val Merino98 = Color(0xFFFCF9F2)
val Merino96 = Color(0xFFF9F4E9)
val Merino94 = Color(0xFFF5EEDD) // the brand value itself
val Merino88 = Color(0xFFEBE2CC)
val Merino80 = Color(0xFFDCD0B4)
val Merino70 = Color(0xFFC6B999)

// --- Rock Blue ramp ---------------------------------------------------------

val RockBlue92 = Color(0xFFDCEAF2)
val RockBlue86 = Color(0xFFC9E0EC)
val RockBlue76 = Color(0xFFA9CADD)
val RockBlue68 = Color(0xFF84B3CE) // the brand value itself
val RockBlue52 = Color(0xFF5F93B1)
val RockBlue40 = Color(0xFF477C9A)

// --- Venice Blue ramp -------------------------------------------------------

val Venice34 = Color(0xFF1D6A93) // lifted, for pressed/hover ink
val Venice28 = Color(0xFF16587B) // the brand value itself
val Venice22 = Color(0xFF124964)
val Venice16 = Color(0xFF0E3A52)
val Venice12 = Color(0xFF0C2D3E)
val Venice08 = Color(0xFF08222F)
val Venice05 = Color(0xFF04161F)

// --- Warm greys (text and outlines on paper) --------------------------------

val Ink10 = Color(0xFF1B1A16)
val Ink20 = Color(0xFF32302A)
val Ink30 = Color(0xFF4C4739)
val Ink50 = Color(0xFF7A735F)
val Ink60 = Color(0xFF8A836F)
val Ink85 = Color(0xFFD5CBB4)

// --- Status ------------------------------------------------------------------
// Amber and clay are deliberately desaturated so they sit next to Merino
// without shouting; they are used only for TIGHT and BLOCKED verdicts,
// failures, and destructive actions.

val AmberLight = Color(0xFF8A5A00)
val AmberContainerLight = Color(0xFFF6E4C0)
val AmberDark = Color(0xFFF0C070)
val AmberContainerDark = Color(0xFF5B3D05)

val ClayLight = Color(0xFF9C3327)
val ClayContainerLight = Color(0xFFF7DCD8)
val ClayDark = Color(0xFFFFB4A8)
val ClayContainerDark = Color(0xFF6E2319)

val GoodLight = Venice22
val GoodContainerLight = RockBlue86
val GoodDark = RockBlue68
val GoodContainerDark = Venice22
