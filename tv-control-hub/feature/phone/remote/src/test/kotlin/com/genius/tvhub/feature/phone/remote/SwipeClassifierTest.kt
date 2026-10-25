package com.genius.tvhub.feature.phone.remote

import com.genius.tvhub.core.model.KeyAction
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SwipeClassifierTest {
    private val c = SwipeClassifier(triggerPx = 50f)

    @Test fun shortMovesAreNotSwipes() {
        assertThat(c.classify(30f, 0f)).isNull()
        assertThat(c.classify(0f, -49f)).isNull()
    }

    @Test fun dominantAxisWins() {
        assertThat(c.classify(80f, 10f)).isEqualTo(Swipe.RIGHT)
        assertThat(c.classify(-80f, 20f)).isEqualTo(Swipe.LEFT)
        assertThat(c.classify(5f, 90f)).isEqualTo(Swipe.DOWN)
        assertThat(c.classify(-10f, -60f)).isEqualTo(Swipe.UP)
    }

    @Test fun diagonalIsAmbiguousUntilOneAxisLeads() {
        assertThat(c.classify(60f, 55f)).isNull()
        assertThat(c.classify(90f, 55f)).isEqualTo(Swipe.RIGHT)
    }

    @Test fun repeatAccelerates() {
        val delays = (0..12).map(SwipeClassifier::repeatDelay)
        assertThat(delays.first()).isEqualTo(350)
        assertThat(delays).isInOrder(Comparator.reverseOrder<Long>())
        assertThat(delays.last()).isEqualTo(45)
    }

    @Test fun swipesMapToPhysicalArrows() {
        assertThat(Swipe.LEFT.toKey()).isEqualTo(KeyAction.LEFT)
        assertThat(Swipe.UP.toKey()).isEqualTo(KeyAction.UP)
    }
}
