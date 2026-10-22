plugins {
    id("tvhub.android.application")
    id("tvhub.android.compose")
}

android {
    namespace = "com.tvhub.tv"

    defaultConfig {
        applicationId = "com.tvhub.tv"
        // Google TV on the target box is Android 11+ (wireless debugging, scoped storage behaviour).
        // Confirmed against the real device in the Phase 1 capability probe.
        minSdk = 30
        versionCode = 1
        versionName = "0.1.0"
        // The target box is arm64. Shipping other ABIs would only add the size of libwebrtc.
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:design"))
    implementation(project(":core:protocol"))
    implementation(project(":engines:input:api"))
    implementation(project(":engines:input:tv"))
    implementation(project(":engines:monitor:tv"))
    implementation(project(":engines:stream:tv"))
    implementation(project(":engines:transport:tv"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.tv.material)
    implementation(libs.kotlinx.coroutines.core)
}
