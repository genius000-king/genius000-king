package io.nawah.linux

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.io.File

/**
 * The two translations must stay the same shape.
 *
 * There were 245 strings and 112 of them were referenced by nothing — leftovers
 * from an earlier naming scheme, sitting in both files. Dead strings are worse
 * than clutter here: every one is a line a translator works through for a
 * screen that does not exist, and the first thing to rot when the two files
 * drift.
 */
class StringsTest {

    private val english = read("app/src/main/res/values/strings.xml")
    private val arabic = read("app/src/main/res/values-ar/strings.xml")

    private operator fun Map<String, String>.plus(other: Map<String, String>): List<Pair<String, String>> =
        toList() + other.toList()

    private fun read(path: String): Map<String, String> {
        val file = File(path).takeIf { it.isFile } ?: File("../$path")
        val text = file.readText()
        return Regex("""<string name="([^"]+)"[^>]*>(.*?)</string>""", RegexOption.DOT_MATCHES_ALL)
            .findAll(text)
            .associate { it.groupValues[1] to it.groupValues[2] }
    }

    @Test
    fun `every english string has an arabic one`() {
        assertThat(english.keys - arabic.keys).isEmpty()
    }

    @Test
    fun `arabic has no strings english does not`() {
        // A string only in Arabic is a string the code cannot reach.
        assertThat(arabic.keys - english.keys).isEmpty()
    }

    @Test
    fun `nothing is left untranslated`() {
        // Names of things stay as they are; sentences must not.
        val untranslated = english.keys
            .filter { english[it] == arabic[it] && english.getValue(it).count { c -> c == ' ' } >= 3 }

        assertThat(untranslated).isEmpty()
    }

    @Test
    fun `every apostrophe is escaped`() {
        // An unescaped apostrophe is not a warning: aapt refuses to flatten the
        // resource and the whole build fails with "Invalid unicode escape
        // sequence in string" — a message that names neither the quote nor the
        // word it is in. It has cost this project three builds.
        val unescaped = (english + arabic)
            .filter { (_, value) -> Regex("""(?<!\\)'""").containsMatchIn(value) }
            .map { it.first }

        assertThat(unescaped).isEmpty()
    }

    @Test
    fun `no format placeholder is lost in translation`() {
        val placeholder = Regex("""%[0-9]*\$?[sd]""")
        for (key in english.keys) {
            val here = placeholder.findAll(english.getValue(key)).count()
            val there = placeholder.findAll(arabic.getValue(key)).count()
            assertThat("$key: $here vs $there").isEqualTo("$key: $here vs $here")
            assertThat(there).isEqualTo(here)
        }
    }
}
