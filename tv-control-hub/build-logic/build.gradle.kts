plugins {
    `java-gradle-plugin`
    alias(libs.plugins.kotlin.jvm)
}

// kotlin-dsl is deliberately not used: it pulls the Gradle-embedded Kotlin stack as a second,
// older copy, which doubles the downloads and hits repository rate limits.
dependencies {
    implementation(gradleKotlinDsl())
    implementation(libs.android.gradle.plugin)
    implementation(libs.kotlin.gradle.plugin)
    implementation(libs.kotlin.compose.compiler.plugin)
    implementation(libs.kotlin.serialization.gradle.plugin)
    implementation(libs.detekt.gradle.plugin)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "tvhub.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidLibrary") {
            id = "tvhub.android.library"
            implementationClass = "AndroidLibraryConventionPlugin"
        }
        register("androidCompose") {
            id = "tvhub.android.compose"
            implementationClass = "AndroidComposeConventionPlugin"
        }
        register("jvmLibrary") {
            id = "tvhub.jvm.library"
            implementationClass = "JvmLibraryConventionPlugin"
        }
    }
}
