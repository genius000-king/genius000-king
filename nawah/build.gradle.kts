plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

// The vendored termux-x11 modules are plain Groovy builds that call
// `apply plugin: 'com.android.library'` without declaring a version, so they
// rely on the plugin already being on the build classpath -- which the
// `apply false` entries above provide.
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
