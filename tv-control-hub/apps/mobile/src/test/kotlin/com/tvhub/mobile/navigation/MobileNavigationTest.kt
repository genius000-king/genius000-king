package com.tvhub.mobile.navigation

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the information architecture: five sections, and no screen that crowds
 * the user with too many choices at once (progressive disclosure).
 */
class MobileNavigationTest {

    private val maxPagesPerSection = 6

    @Test
    fun `bottom bar has exactly the five agreed sections in order`() {
        assertEquals(
            listOf("home", "control", "device", "tools", "settings"),
            MobileSection.entries.map { it.route },
        )
    }

    @Test
    fun `home is an overview and owns no sub-pages`() {
        assertTrue(MobileSection.Home.pages.isEmpty())
    }

    @Test
    fun `every other section keeps its list short`() {
        MobileSection.entries.filter { it != MobileSection.Home }.forEach { section ->
            val count = section.pages.size
            assertTrue(count in 1..maxPagesPerSection, "${section.name} has $count pages")
        }
    }

    @Test
    fun `every page belongs to exactly one section`() {
        val pagesFromSections = MobileSection.entries.flatMap { it.pages }

        assertEquals(MobilePage.entries.size, pagesFromSections.size)
        assertEquals(MobilePage.entries.toSet(), pagesFromSections.toSet())
    }

    @Test
    fun `full routes are unique across the whole app`() {
        val sectionRoutes = MobileSection.entries.map { it.route }
        val pageRoutes = MobilePage.entries.map { it.fullRoute }

        assertEquals(pageRoutes.size, pageRoutes.toSet().size, "duplicate page route")
        assertTrue(pageRoutes.none { it in sectionRoutes }, "page route collides with a section route")
    }

    @Test
    fun `every page route is prefixed by its section route`() {
        MobilePage.entries.forEach { page ->
            assertTrue(page.fullRoute.startsWith("${page.section.route}/"), page.fullRoute)
        }
    }

    @Test
    fun `every page is planned for a real roadmap phase`() {
        MobilePage.entries.forEach { page ->
            assertTrue(page.plannedPhase in 1..7, "${page.name} has phase ${page.plannedPhase}")
        }
    }
}
