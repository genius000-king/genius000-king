package com.genius.tvhub.engine.apps.catalog

/** A launchable activity as PackageManager reports it, reduced to what the catalog needs. */
data class LaunchEntry(val packageName: String, val label: String, val isSystem: Boolean)

/** One app in the catalog: TV apps and phone apps side by side. */
data class CatalogApp(val packageName: String, val label: String, val isTvApp: Boolean, val isSystem: Boolean)

/**
 * Google TV's home lists only apps with a TV (leanback) entry; this merges both lists so phone
 * apps appear too. Pure: the Android side only gathers the two lists.
 */
object CatalogMerger {
    fun merge(leanback: List<LaunchEntry>, launcher: List<LaunchEntry>, hidden: Set<String>): List<CatalogApp> {
        val tv = leanback.associateBy { it.packageName }
        val all = LinkedHashMap<String, CatalogApp>()
        (leanback + launcher).forEach { e ->
            if (e.packageName in hidden || e.packageName in all) return@forEach
            all[e.packageName] = CatalogApp(e.packageName, e.label.trim().ifEmpty { e.packageName }, e.packageName in tv, e.isSystem)
        }
        return all.values.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.label })
    }
}
