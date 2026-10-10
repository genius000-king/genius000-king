package com.genius.imlaq.models.catalog

import com.genius.imlaq.common.Bytes

enum class FitLevel {
    /** Runs at a pace you can chat at. */
    GOOD,

    /** Runs, but slowly: worth it for a hard question, not for small talk. */
    SLOW,

    /** Not enough free storage to download it. */
    NO_SPACE,

    /** This phone's RAM is below what the model needs even when streamed. */
    NOT_ENOUGH_RAM,

    /** A model with no measured speed that fits in RAM with room to spare: it runs at full speed. */
    FITS_RAM,

    /** A model with no measured speed that is bigger than the RAM it can have: it streams from storage. */
    STREAMS,
}

data class Fit(val level: FitLevel, /** For NO_SPACE: how much more space is needed. */ val missing: Bytes = Bytes.ZERO)

/**
 * "Does this model suit my phone?" — answered before a multi-GB download, from three facts:
 * free storage, total RAM, and the speed the model was measured at on a reference phone.
 * Storage and RAM are hard limits; speed only splits "good" from "slow".
 */
object FitJudge {

    /** At or above this a reply streams fast enough to read along. */
    const val CHATTY_TOKENS_PER_SECOND = 2.0

    fun assess(entry: CatalogEntry, totalRam: Bytes, freeStorage: Bytes, alreadyDownloaded: Bytes = Bytes.ZERO): Fit {
        val needed = Bytes(entry.totalBytes) - alreadyDownloaded
        if (needed > freeStorage) return Fit(FitLevel.NO_SPACE, needed - freeStorage)
        if (!hasRam(totalRam, entry.minRam)) return Fit(FitLevel.NOT_ENOUGH_RAM)
        val fast = entry.referenceTokensPerSecond >= CHATTY_TOKENS_PER_SECOND && hasRam(totalRam, entry.comfortableRam)
        return Fit(if (fast) FitLevel.GOOD else FitLevel.SLOW)
    }

    /**
     * For any model off the internet, where no speed was ever measured: only what is certain.
     * It fits the storage or not, and it fits in RAM (half of it, leaving the phone the rest) or
     * it streams from storage, which is slower but is exactly what this app is for.
     */
    fun assessSize(totalBytes: Long, totalRam: Bytes, freeStorage: Bytes, alreadyDownloaded: Bytes = Bytes.ZERO): Fit {
        val needed = Bytes(totalBytes) - alreadyDownloaded
        if (needed > freeStorage) return Fit(FitLevel.NO_SPACE, needed - freeStorage)
        return Fit(if (totalBytes <= totalRam.value / 2) FitLevel.FITS_RAM else FitLevel.STREAMS)
    }

    /**
     * A phone sold as "12 GB" reports about 11.2 GiB: the kernel and firmware keep the rest.
     * Requirements are written in the sold sizes, so allow that margin.
     */
    fun hasRam(totalRam: Bytes, required: Bytes) = totalRam.value >= required.value * 0.85
}
