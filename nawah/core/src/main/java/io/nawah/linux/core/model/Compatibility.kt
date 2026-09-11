package io.nawah.linux.core.model

/**
 * Verdict for one device signal, or for a whole device.
 *
 * Three levels rather than two because the interesting case is the middle one:
 * a 3 GB phone *will* run Debian + XFCE, badly. Collapsing that into "supported"
 * produces a one-star review; collapsing it into "unsupported" removes a device
 * that works. [TIGHT] is the honest answer, and it is why every non-[GOOD]
 * signal is required to explain itself.
 *
 * Declared in worsening order so `maxOf`/`minOf` over the enum's natural
 * ordering picks the worst signal — see `CompatRules.overallOf`.
 */
enum class Compatibility { GOOD, TIGHT, BLOCKED }

/**
 * One line of the compatibility badge.
 *
 * [detail] carries both the measurement and, for anything worse than
 * [Compatibility.GOOD], the reason — e.g. `"1.5 GB — below the 2 GB minimum"`.
 * The contract has no separate `reason` field, and splitting the string in the
 * UI would be guesswork, so the reason is appended after an em dash and the
 * whole line is rendered as-is.
 */
data class CompatSignal(
    /** Short axis name: `"RAM"`, `"Storage"`, `"CPU"`. */
    val label: String,
    /** Measurement, plus the reason when the verdict is not [Compatibility.GOOD]. */
    val detail: String,
    val verdict: Compatibility,
)

/**
 * The compatibility badge shown next to a distribution in the wizard.
 *
 * [overall] is the worst of [signals] — a device is only as compatible as its
 * weakest axis, and averaging would hide the one thing that stops the install.
 */
data class CompatReport(
    val overall: Compatibility,
    val signals: List<CompatSignal>,
    /**
     * Null until the live proot probe has run; see `DeviceProbe.runProotProbe()`.
     *
     * Null means "not measured yet", *not* "unknown forever" — the difference
     * matters because the UI shows a spinner for one and a hard failure for the
     * other. A `false` here overrides every static signal: an OEM kernel with
     * ptrace disabled makes the rest of the report irrelevant.
     */
    val prootWorks: Boolean?,
)
