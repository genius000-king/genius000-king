package com.genius.tvhub.engine.apps.install

/**
 * Bookkeeping for one streamed install: every split must arrive in order and complete before
 * commit. Pure, so a broken transfer is caught here instead of as a corrupt APK.
 */
class InstallLedger(val splitSizes: List<Long>) {
    private val written = LongArray(splitSizes.size)

    init { require(splitSizes.isNotEmpty() && splitSizes.all { it > 0 }) { "at least one non-empty APK" } }

    fun accept(split: Int, offset: Long, length: Int) {
        require(split in splitSizes.indices) { "no split $split" }
        require(offset == written[split]) { "split $split expected offset ${written[split]}, got $offset" }
        require(offset + length <= splitSizes[split]) { "split $split overflows its declared size" }
        written[split] += length
    }

    val complete get() = splitSizes.indices.all { written[it] == splitSizes[it] }
    val progress get() = written.sum().toFloat() / splitSizes.sum()
    fun splitName(i: Int) = if (i == 0) "base.apk" else "split_$i.apk"
}
