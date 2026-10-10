plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.genius.imlaq.engine.host"
    compileSdk = 37
    defaultConfig {
        minSdk = 29
        // The engines ship as prebuilt arm64 executables staged by scripts/build-native.sh.
        ndk { abiFilters += "arm64-v8a" }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    api(project(":engine:api"))
    api(project(":core:memory"))
    implementation(project(":core:models"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
