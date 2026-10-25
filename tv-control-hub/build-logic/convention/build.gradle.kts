plugins {
    `kotlin-dsl`
}

group = "com.genius.tvhub.buildlogic"


dependencies {
    compileOnly(libs.android.gradle.plugin)
    compileOnly(libs.kotlin.gradle.plugin)
    compileOnly(libs.compose.gradle.plugin)
}

gradlePlugin {
    plugins {
        register("jvmLibrary") { id = "tvhub.jvm.library"; implementationClass = "com.genius.tvhub.buildlogic.JvmLibraryPlugin" }
        register("androidLibrary") { id = "tvhub.android.library"; implementationClass = "com.genius.tvhub.buildlogic.AndroidLibraryPlugin" }
        register("androidCompose") { id = "tvhub.android.compose"; implementationClass = "com.genius.tvhub.buildlogic.AndroidComposePlugin" }
        register("androidHilt") { id = "tvhub.android.hilt"; implementationClass = "com.genius.tvhub.buildlogic.AndroidHiltPlugin" }
        register("androidFeature") { id = "tvhub.android.feature"; implementationClass = "com.genius.tvhub.buildlogic.AndroidFeaturePlugin" }
        register("androidApplication") { id = "tvhub.android.application"; implementationClass = "com.genius.tvhub.buildlogic.AndroidApplicationPlugin" }
    }
}
