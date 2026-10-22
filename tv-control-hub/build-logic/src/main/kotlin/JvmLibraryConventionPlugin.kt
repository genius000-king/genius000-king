import org.gradle.api.JavaVersion
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

/** Pure-Kotlin modules. They have no Android dependency, so they are tested on the JVM only. */
class JvmLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.jvm")
            // Applied here so modules never depend on the plugin portal for it.
            pluginManager.apply("org.jetbrains.kotlin.plugin.serialization")

            extensions.configure<JavaPluginExtension> {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
            }
            tasks.withType<KotlinCompile>().configureEach {
                it.compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
            }

            configureTestsAndAnalysis()
        }
    }
}
