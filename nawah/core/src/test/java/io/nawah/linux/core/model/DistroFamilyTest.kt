package io.nawah.linux.core.model

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class DistroFamilyTest {

    private fun version(id: String, lts: Boolean = false, enabled: Boolean = true) = DistroSpec(
        id = id, name = id, version = id, codename = id, image = "library/$id",
        downloadBytes = 1, installedBytes = 1, aptMirror = "http://example.invalid",
        lts = lts, enabled = enabled,
    )

    private fun family(vararg versions: DistroSpec) =
        DistroFamily("f", "Family", LocalizedText.of("t"), versions.toList())

    @Test
    fun `the default is the newest LTS, not the first row`() {
        // The default a user accepts without reading is the one that has to be
        // right, and "whatever is first in the file" is not a decision.
        val family = family(version("rolling"), version("lts-24", lts = true), version("lts-22", lts = true))

        assertThat(family.default?.id).isEqualTo("lts-24")
    }

    @Test
    fun `a family with no LTS falls back to its newest release`() {
        assertThat(family(version("a"), version("b")).default?.id).isEqualTo("a")
    }

    @Test
    fun `a disabled release is never the default`() {
        val family = family(version("broken", lts = true, enabled = false), version("good"))

        assertThat(family.default?.id).isEqualTo("good")
    }

    @Test
    fun `a family with nothing enabled has no default rather than a bad one`() {
        assertThat(family(version("x", enabled = false)).default).isNull()
    }
}
