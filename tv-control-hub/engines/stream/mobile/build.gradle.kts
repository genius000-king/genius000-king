plugins {
    id("tvhub.android.library")
    id("tvhub.android.compose")
}

android {
    namespace = "com.tvhub.stream.mobile"
}

dependencies {
    implementation(project(":core:protocol"))
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.webrtc.android)
}
