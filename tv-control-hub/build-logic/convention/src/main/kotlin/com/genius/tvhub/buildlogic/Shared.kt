package com.genius.tvhub.buildlogic

import com.android.build.api.dsl.CommonExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension

/** One place for the numbers every module shares. */
object Build {
    const val COMPILE_SDK = 37
    const val TARGET_SDK = 36
    /** Android 10: oldest phone we support. The TV box runs Android 14. */
    const val MIN_SDK = 29
    val JAVA = JavaVersion.VERSION_17
}

internal val Project.libs: VersionCatalog
    get() = extensions.getByType<VersionCatalogsExtension>().named("libs")

internal fun VersionCatalog.lib(alias: String) = findLibrary(alias).get()

internal fun Project.configureAndroid(ext: CommonExtension) {
    ext.apply {
        compileSdk = Build.COMPILE_SDK
        defaultConfig.minSdk = Build.MIN_SDK
        compileOptions.sourceCompatibility = Build.JAVA
        compileOptions.targetCompatibility = Build.JAVA
        testOptions.unitTests.isIncludeAndroidResources = true
        testOptions.unitTests.isReturnDefaultValues = true
        lint.abortOnError = true
        lint.warningsAsErrors = false
        lint.disable += setOf("GradleDependency", "NewerVersionAvailable", "AndroidGradlePluginVersion", "ObsoleteLintCustomCheck", "OldTargetApi")
    }
    extensions.getByType<KotlinAndroidProjectExtension>().compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.addAll("-Xcontext-parameters", "-opt-in=kotlin.RequiresOptIn")
    }
    configureTests()
}

internal fun Project.configureKotlinJvm() {
    // No toolchain: CI and local builds use whatever JDK runs Gradle (17+), targeting 17 bytecode.
    extensions.getByType<org.gradle.api.plugins.JavaPluginExtension>().apply {
        sourceCompatibility = Build.JAVA
        targetCompatibility = Build.JAVA
    }
    extensions.getByType<KotlinJvmProjectExtension>().compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.add("-opt-in=kotlin.RequiresOptIn")
    }
    configureTests()
}

internal fun Project.configureTests() {
    tasks.withType<Test>().configureEach {
        maxHeapSize = "2g"
        // Screen modules without unit tests yet are not a misconfiguration.
        failOnNoDiscoveredTests.set(false)
        // Robolectric fetches its android-all jar at run time; use the same Central mirror as Gradle.
        systemProperty("robolectric.dependency.repo.url", "https://maven-central.storage-download.googleapis.com/maven2")
        systemProperty("robolectric.logging.enabled", "false")
        testLogging {
            events("failed")
            exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        }
    }
    dependencies.apply {
        add("testImplementation", libs.lib("junit"))
        add("testImplementation", libs.lib("truth"))
        add("testImplementation", libs.lib("turbine"))
        add("testImplementation", libs.lib("kotlinx-coroutines-test"))
        add("testImplementation", "org.jetbrains.kotlin:kotlin-test")
    }
}
