plugins {
    id("tvhub.android.application")
    id("tvhub.android.compose")
}

android {
    namespace = "com.tvhub.mobile"

    defaultConfig {
        applicationId = "com.tvhub.mobile"
        versionCode = 1
        versionName = "0.1.0"
    }
}

dependencies {
    implementation(project(":core:design"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
}
