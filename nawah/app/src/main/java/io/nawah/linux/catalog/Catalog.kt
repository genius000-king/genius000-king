package io.nawah.linux.catalog

import android.content.Context
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroSpec
import kotlinx.serialization.json.Json

/**
 * The list of distributions and desktops the app can install.
 *
 * This is data, not code, and that is the whole point: adding Ubuntu, Arch,
 * KDE or LXQt later is a new entry in `assets/catalog/distros.json` and `desktops.json`, not a new class.
 * Nothing downstream branches on a distro id.
 */
class Catalog private constructor(
    val distros: List<DistroSpec>,
    val desktops: List<DesktopSpec>,
) {
    fun distro(id: String): DistroSpec? = distros.firstOrNull { it.id == id }
    fun desktop(id: String): DesktopSpec? = desktops.firstOrNull { it.id == id }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun load(context: Context): Catalog {
            fun <T> read(path: String, parse: (String) -> T): T =
                context.assets.open(path).bufferedReader().use { parse(it.readText()) }

            val distros = read("catalog/distros.json") {
                json.decodeFromString<List<DistroSpec>>(it)
            }.filter { it.enabled }
            val desktops = read("catalog/desktops.json") {
                json.decodeFromString<List<DesktopSpec>>(it)
            }.filter { it.enabled }
            return Catalog(distros, desktops)
        }
    }
}
