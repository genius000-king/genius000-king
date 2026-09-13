package io.nawah.linux.catalog

import android.content.Context
import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.DistroFamily
import io.nawah.linux.core.model.DistroSpec
import kotlinx.serialization.json.Json

/**
 * The list of distributions and desktops the app can install.
 *
 * This is data, not code, and that is the whole point: adding a distribution,
 * a release or a desktop is an entry in `assets/catalog/distros.json` and
 * `desktops.json`, not a new class. Nothing downstream branches on an id.
 *
 * Distributions are two levels — family, then version — because that is how a
 * person looks for one. [distros] flattens them for lookup, since a machine
 * records the version's id and knows nothing about families.
 */
class Catalog private constructor(
    val families: List<DistroFamily>,
    val desktops: List<DesktopSpec>,
) {
    /** Every enabled version across every enabled family, in catalog order. */
    val distros: List<DistroSpec> = families.flatMap { it.versions }

    fun distro(id: String): DistroSpec? = distros.firstOrNull { it.id == id }
    fun desktop(id: String): DesktopSpec? = desktops.firstOrNull { it.id == id }

    /** The family a version belongs to, for showing a machine's origin. */
    fun familyOf(distroId: String): DistroFamily? =
        families.firstOrNull { family -> family.versions.any { it.id == distroId } }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        fun load(context: Context): Catalog {
            fun <T> read(path: String, parse: (String) -> T): T =
                context.assets.open(path).bufferedReader().use { parse(it.readText()) }

            val families = read("catalog/distros.json") {
                json.decodeFromString<List<DistroFamily>>(it)
            }
                .filter { it.enabled }
                .map { family -> family.copy(versions = family.versions.filter { it.enabled }) }
                .filter { it.versions.isNotEmpty() }

            val desktops = read("catalog/desktops.json") {
                json.decodeFromString<List<DesktopSpec>>(it)
            }.filter { it.enabled }

            return Catalog(families, desktops)
        }
    }
}
