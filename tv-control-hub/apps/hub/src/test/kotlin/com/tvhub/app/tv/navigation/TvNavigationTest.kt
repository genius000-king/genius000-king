package com.tvhub.app.tv.navigation

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The TV app has exactly six screens, and each one is reachable and planned. */
class TvNavigationTest {

    @Test
    fun `TV has exactly the six agreed screens`() {
        assertEquals(6, TvScreen.entries.size)
    }

    @Test
    fun `routes are unique`() {
        val routes = TvScreen.entries.map { it.route }

        assertEquals(routes.size, routes.toSet().size)
    }

    @Test
    fun `every screen is planned for a real roadmap phase`() {
        TvScreen.entries.forEach { screen ->
            assertTrue(screen.plannedPhase in 1..7, "${screen.name} has phase ${screen.plannedPhase}")
        }
    }
}
