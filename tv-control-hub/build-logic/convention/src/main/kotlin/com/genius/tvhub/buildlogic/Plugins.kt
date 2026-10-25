package com.genius.tvhub.buildlogic

import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

/** Pure Kotlin module: no Android, testable on the plain JVM. */
class JvmLibraryPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("org.jetbrains.kotlin.jvm")
        configureKotlinJvm()
    }
}

class AndroidLibraryPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("com.android.library")
        extensions.configure<LibraryExtension> {
            configureAndroid(this)
            // Namespace follows the module path: :engine:stream -> com.genius.tvhub.engine.stream
            namespace = "com.genius.tvhub" + path.replace(':', '.').replace('-', '_')
            defaultConfig.consumerProguardFiles("consumer-rules.pro")
        }
        dependencies {
            add("testImplementation", libs.lib("robolectric"))
            add("testImplementation", libs.lib("androidx-test-core"))
            add("testImplementation", libs.lib("androidx-test-ext-junit"))
        }
    }
}

class AndroidComposePlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
        val ext = extensions.findByType(LibraryExtension::class.java) ?: extensions.getByType(ApplicationExtension::class.java)
        ext.buildFeatures.compose = true
        dependencies {
            val bom = platform(libs.lib("compose-bom"))
            add("implementation", bom)
            add("testImplementation", bom)
            add("implementation", libs.lib("compose-ui"))
            add("implementation", libs.lib("compose-foundation"))
            add("implementation", libs.lib("compose-material3"))
            add("implementation", libs.lib("compose-ui-tooling-preview"))
            add("debugImplementation", libs.lib("compose-ui-tooling"))
            add("testImplementation", libs.lib("compose-ui-test-junit4"))
            add("debugImplementation", libs.lib("compose-ui-test-manifest"))
        }
    }
}

class AndroidHiltPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("com.google.devtools.ksp")
        pluginManager.apply("com.google.dagger.hilt.android")
        dependencies {
            add("implementation", libs.lib("hilt-android"))
            add("ksp", libs.lib("hilt-compiler"))
        }
    }
}

/** A screen module: Compose + Hilt + the design system, nothing else by default. */
class AndroidFeaturePlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("tvhub.android.library")
        pluginManager.apply("tvhub.android.compose")
        pluginManager.apply("tvhub.android.hilt")
        dependencies {
            add("implementation", project(":core:designsystem"))
            add("implementation", project(":core:model"))
            add("implementation", project(":core:common"))
            add("implementation", libs.lib("androidx-lifecycle-runtime-compose"))
            add("implementation", libs.lib("androidx-lifecycle-viewmodel-compose"))
            add("implementation", libs.lib("hilt-navigation-compose"))
            add("implementation", libs.lib("androidx-navigation-compose"))
            add("testImplementation", libs.lib("roborazzi"))
            add("testImplementation", libs.lib("roborazzi-compose"))
            add("testImplementation", libs.lib("roborazzi-junit-rule"))
        }
    }
}

class AndroidApplicationPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("com.android.application")
        extensions.configure<ApplicationExtension> {
            configureAndroid(this)
            defaultConfig.targetSdk = Build.TARGET_SDK
        }
        dependencies {
            add("testImplementation", libs.lib("robolectric"))
            add("testImplementation", libs.lib("androidx-test-core"))
        }
    }
}
