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
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }
}

dependencies {
    implementation(project(":core:design"))
    implementation(project(":core:protocol"))
    implementation(project(":engines:input:api"))
    implementation(project(":engines:stream:mobile"))
    implementation(project(":engines:transport:mobile"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.coroutines.core)
}
