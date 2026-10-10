plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.genius.imlaq.device"
    compileSdk = 37
    defaultConfig { minSdk = 29 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    api(project(":core:memory"))
    implementation(libs.kotlinx.coroutines.android)
}
