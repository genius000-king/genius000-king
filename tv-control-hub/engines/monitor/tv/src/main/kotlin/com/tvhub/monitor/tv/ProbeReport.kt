package com.tvhub.monitor.tv

/** One fact about the device. A value of "unavailable" is a finding, not a placeholder. */
data class ProbeItem(
    val label: String,
    val value: String,
)

data class ProbeSection(
    val title: String,
    val items: List<ProbeItem>,
)

/** What this device exposes to an app without root. Read it before deciding what the product can promise. */
data class ProbeReport(
    val sections: List<ProbeSection>,
)
