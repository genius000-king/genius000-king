import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

/** Adds Compose to any Android module, with versions aligned by the Compose BOM. */
class AndroidComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.plugin.compose")

            pluginManager.withPlugin("com.android.application") {
                extensions.configure<ApplicationExtension> {
                    buildFeatures { compose = true }
                }
            }
            pluginManager.withPlugin("com.android.library") {
                extensions.configure<LibraryExtension> {
                    buildFeatures { compose = true }
                }
            }

            val catalog = versionCatalog
            val handler = dependencies
            handler.add("implementation", handler.platform(catalog.findLibrary("androidx-compose-bom").get()))
            handler.add("implementation", catalog.findLibrary("androidx-compose-ui").get())
            handler.add("implementation", catalog.findLibrary("androidx-compose-material3").get())
            handler.add("implementation", catalog.findLibrary("androidx-compose-material-icons-core").get())
            handler.add("implementation", catalog.findLibrary("androidx-compose-ui-tooling-preview").get())
            handler.add("debugImplementation", catalog.findLibrary("androidx-compose-ui-tooling").get())
        }
    }
}
