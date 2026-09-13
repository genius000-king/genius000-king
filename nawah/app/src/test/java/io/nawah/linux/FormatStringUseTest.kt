package io.nawah.linux

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.io.File

/**
 * A format string fetched without its arguments prints its own placeholder.
 *
 * This shipped: the settings screen showed a row reading literally
 * `%1$s used by this system`. Two screens had grown strings with the same
 * names, one of them a format string, and `stringResource(id)` with no
 * arguments renders the template verbatim rather than failing.
 *
 * Nothing catches that — not the compiler, not lint, and not a test that only
 * compares the two translations. So the source is scanned for it directly.
 */
class FormatStringUseTest {

    private val root: File = File("app/src/main").takeIf { it.isDirectory } ?: File("src/main")

    private val formatted: Set<String> =
        Regex("""<string name="([^"]+)"[^>]*>(.*?)</string>""", RegexOption.DOT_MATCHES_ALL)
            .findAll(File(root, "res/values/strings.xml").readText())
            .filter { Regex("""%[0-9]*\$?[sd]""").containsMatchIn(it.groupValues[2]) }
            .map { it.groupValues[1] }
            .toSet()

    /** `stringResource(R.string.x)` with nothing after the id. */
    private val bareUses: List<Pair<String, String>> =
        root.resolve("java").walkTopDown()
            .filter { it.extension == "kt" }
            .flatMap { file ->
                Regex("""stringResource\(\s*R\.string\.([a-zA-Z0-9_]+)\s*\)""")
                    .findAll(file.readText())
                    .map { file.name to it.groupValues[1] }
            }
            .toList()

    @Test
    fun `the resources do contain format strings, so this test has something to check`() {
        assertThat(formatted).isNotEmpty()
        assertThat(bareUses).isNotEmpty()
    }

    @Test
    fun `no format string is rendered without its arguments`() {
        val wrong = bareUses.filter { (_, name) -> name in formatted }
            .map { (file, name) -> "$file uses R.string.$name, which has a placeholder" }

        assertThat(wrong).isEmpty()
    }
}
