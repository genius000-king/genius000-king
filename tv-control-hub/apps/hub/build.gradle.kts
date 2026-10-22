plugins {
    id("tvhub.android.application")
    id("tvhub.android.compose")
}

android {
    namespace = "com.tvhub.app"

    defaultConfig {
        applicationId = "com.tvhub.app"
        // One APK runs on both devices, so it takes the newer floor. The TV service needs API 29 or later,
        // and the TV box runs Android 11+. Lower this only after the phone and TV paths are both guarded.
        minSdk = 30
        versionCode = 1
        versionName = "0.1.0"
        // The target box and current phones are arm64. Other ABIs would only add the size of libwebrtc.
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
    implementation(project(":engines:stream:mobile"))
    implementation(project(":engines:stream:tv"))
    implementation(project(":engines:transport:mobile"))
    implementation(project(":engines:transport:tv"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.tv.material)
    implementation(libs.kotlinx.coroutines.core)
}
