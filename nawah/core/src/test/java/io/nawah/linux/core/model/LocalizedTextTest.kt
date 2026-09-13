package io.nawah.linux.core.model

import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.Json
import org.junit.Test

/**
 * Catalog text is data in `assets/`, so it has no string-resource translation
 * path. Either it carries its own translations or half the distro picker stays
 * English on an Arabic screen.
 */
class LocalizedTextTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `a plain string is one language, not an error`() {
        val text = json.decodeFromString<LocalizedText>("\"Debian\"")

        assertThat(text.resolve("ar")).isEqualTo("Debian")
        assertThat(text.resolve("en")).isEqualTo("Debian")
    }

    @Test
    fun `an object carries every translation`() {
        val text = json.decodeFromString<LocalizedText>(
            """{"en":"Command line only","ar":"سطر الأوامر فقط"}""",
        )

        assertThat(text.resolve("ar")).isEqualTo("سطر الأوامر فقط")
        assertThat(text.resolve("en")).isEqualTo("Command line only")
    }

    @Test
    fun `a language we have no translation for falls back to english`() {
        // Never an empty row: a missing translation must show the English word.
        val text = json.decodeFromString<LocalizedText>("""{"en":"Storage","ar":"التخزين"}""")

        assertThat(text.resolve("fr")).isEqualTo("Storage")
    }

    @Test
    fun `text with no english at all still resolves to something`() {
        val text = json.decodeFromString<LocalizedText>("""{"ar":"عربي"}""")

        assertThat(text.resolve("fr")).isEqualTo("عربي")
    }

    @Test
    fun `a round trip keeps both languages`() {
        val original = LocalizedText(mapOf("en" to "Free", "ar" to "حر"))

        val back = json.decodeFromString<LocalizedText>(json.encodeToString(original))

        assertThat(back).isEqualTo(original)
    }

    @Test
    fun `a single-language value stays a plain string when written back`() {
        // Forcing {"en": "Debian"} on every proper noun would be noise.
        assertThat(json.encodeToString(LocalizedText.of("Debian"))).isEqualTo("\"Debian\"")
    }
}
