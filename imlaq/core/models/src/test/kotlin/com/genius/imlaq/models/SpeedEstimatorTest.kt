package com.genius.imlaq.models

import com.genius.imlaq.common.Bytes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpeedEstimatorTest {

    private val gb = 1e9
    private val flash = 3 * gb // UFS 4.x, sequential-ish reads
    private val ram = 60 * gb  // LPDDR5X

    /** Shaped like gpt-oss-120b: ~60 GB, 4 of 128 experts per token, ~3 GB dense. */
    private val giantMoe = ModelSummary(
        kind = ModelKind.TEXT_MOE, architecture = "gpt-oss", name = "giant",
        expertCount = 128, expertUsedCount = 4, blockCount = 36, contextLength = 131072,
        totalBytes = Bytes.gib(60), expertBytes = Bytes.gib(57), denseBytes = Bytes.gib(3),
    )

    /** Shaped like a 70B dense model at Q4: ~42 GB, every weight every token. */
    private val denseGiant = ModelSummary(
        kind = ModelKind.TEXT_DENSE, architecture = "llama", name = "dense",
        expertCount = 0, expertUsedCount = 0, blockCount = 80, contextLength = 8192,
        totalBytes = Bytes.gib(42), expertBytes = Bytes.ZERO, denseBytes = Bytes.gib(42),
    )

    @Test
    fun moeReadsOnlyTheActiveExpertsItHasNotCached() {
        val e = SpeedEstimator.estimate(giantMoe, Bytes.gib(6), flash, ram)
        // active experts = 57 * 4/128 GiB; cache = 3 GiB of 57 → hit 3/57
        val expected = Bytes.gib(57) * (4.0 / 128) * (1 - 3.0 / 57)
        assertEquals(expected.value.toDouble(), e.flashBytesPerToken.value.toDouble(), 1e6)
        assertTrue("got ${e.tokensPerSecond}", e.tokensPerSecond in 0.5..3.0)
    }

    @Test
    fun denseGiantPaysForEverythingNotResident() {
        val e = SpeedEstimator.estimate(denseGiant, Bytes.gib(7), flash, ram)
        assertEquals(Bytes.gib(35), e.flashBytesPerToken)
        assertTrue("got ${e.tokensPerSecond}", e.tokensPerSecond < 0.1)
    }

    @Test
    fun aModelThatFitsReadsNothingFromFlash() {
        val e = SpeedEstimator.estimate(denseGiant, Bytes.gib(64), flash, ram)
        assertEquals(Bytes.ZERO, e.flashBytesPerToken)
    }

    @Test
    fun moeWhoseDenseWeightsDoNotFitIsNotRunnable() {
        assertFalse(SpeedEstimator.estimate(giantMoe, Bytes.gib(2), flash, ram).runnable)
    }
}
