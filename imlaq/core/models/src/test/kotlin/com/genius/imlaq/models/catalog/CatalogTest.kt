package com.genius.imlaq.models.catalog

import com.genius.imlaq.common.Bytes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogTest {

    private val gemma = Catalog.byId("gemma4-26b")!!
    private val gptOss = Catalog.byId("gpt-oss-120b")!!
    private val deepseek = Catalog.byId("deepseek-v4-flash")!!

    @Test
    fun everyFileNameAndIdIsUniqueAndEveryUrlIsHttps() {
        val names = Catalog.entries.flatMap { e -> e.files.map { it.name } }
        assertEquals(names.size, names.toSet().size)
        assertEquals(Catalog.entries.size, Catalog.entries.map { it.id }.toSet().size)
        assertTrue(Catalog.entries.flatMap { it.files }.all { it.url.startsWith("https://huggingface.co/") && it.bytes > 0 })
    }

    @Test
    fun shardedModelsOpenFromTheirFirstShard() {
        assertEquals("gpt-oss-120b-Q4_K_M-00001-of-00002.gguf", gptOss.entryFileName)
        assertEquals(62_768_723_552L, gptOss.totalBytes)
        assertEquals(deepseek, Catalog.ownerOf("DeepSeek-V4-Flash-0731-UD-IQ2_M-00003-of-00003.gguf"))
    }

    @Test
    fun aTwelveGigPhoneWithSpaceRunsTheThirtyBClassWell() {
        // A "12 GB" phone reports ~11.2 GiB.
        val fit = FitJudge.assess(gemma, totalRam = Bytes.gib(11.2), freeStorage = Bytes.gib(100))
        assertEquals(FitLevel.GOOD, fit.level)
    }

    @Test
    fun theGiantsRunButSlowly() {
        assertEquals(FitLevel.SLOW, FitJudge.assess(gptOss, Bytes.gib(11.2), Bytes.gib(100)).level)
    }

    @Test
    fun notEnoughStorageSaysHowMuchIsMissing() {
        val fit = FitJudge.assess(deepseek, Bytes.gib(11.2), freeStorage = Bytes(80_000_000_000L))
        assertEquals(FitLevel.NO_SPACE, fit.level)
        assertEquals(Bytes(deepseek.totalBytes - 80_000_000_000L), fit.missing)
    }

    @Test
    fun aPartialDownloadOnlyNeedsTheRest() {
        val free = Bytes(10_000_000_000L)
        assertEquals(FitLevel.NO_SPACE, FitJudge.assess(gemma, Bytes.gib(11.2), free).level)
        assertEquals(FitLevel.GOOD, FitJudge.assess(gemma, Bytes.gib(11.2), free, alreadyDownloaded = Bytes(9_000_000_000L)).level)
    }

    @Test
    fun aSixGigPhoneCannotRunThem() {
        assertEquals(FitLevel.NOT_ENOUGH_RAM, FitJudge.assess(gemma, Bytes.gib(5.6), Bytes.gib(100)).level)
    }

    @Test
    fun anEightGigPhoneRunsTheThirtyBClassSlowly() {
        assertEquals(FitLevel.SLOW, FitJudge.assess(gemma, Bytes.gib(7.5), Bytes.gib(100)).level)
    }
}
