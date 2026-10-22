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
    }
}

dependencies {
    implementation(project(":core:design"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.tv.material)
}
