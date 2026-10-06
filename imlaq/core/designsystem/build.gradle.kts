plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.genius.imlaq.designsystem"
    compileSdk = 37
    defaultConfig { minSdk = 29 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}

dependencies {
    api(platform(libs.androidx.compose.bom))
    api(libs.androidx.compose.ui)
    api(libs.androidx.compose.material3)
    api(libs.androidx.compose.ui.tooling.preview)
    // Backdrop blur for the frosted glass (RenderEffect on Android 12+, a translucent scrim below).
    api(libs.haze)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
