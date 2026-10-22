import io.gitlab.arturbosch.detekt.extensions.DetektExtension
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType

internal const val COMPILE_SDK = 37

/** Minor level of the platform: the Compose BOM requires API 37.2 APIs, so compile against 37.2. */
internal const val COMPILE_SDK_MINOR = 2
internal const val TARGET_SDK = 37
internal const val DEFAULT_MIN_SDK = 26

internal val Project.versionCatalog: VersionCatalog
    get() = extensions.getByType<VersionCatalogsExtension>().named("libs")

/** Every module runs JUnit 5 and the same static analysis rules. */
internal fun Project.configureTestsAndAnalysis() {
    tasks.withType<Test>().configureEach { it.useJUnitPlatform() }

    val catalog = versionCatalog
    dependencies.add("testImplementation", catalog.findLibrary("junit-jupiter").get())
    dependencies.add("testImplementation", catalog.findLibrary("kotlin-test-junit5").get())
    dependencies.add("testRuntimeOnly", catalog.findLibrary("junit-platform-launcher").get())

    pluginManager.apply("io.gitlab.arturbosch.detekt")
    extensions.configure<DetektExtension> {
        buildUponDefaultConfig = true
        config.setFrom(rootProject.files("config/detekt/detekt.yml"))
    }
}
