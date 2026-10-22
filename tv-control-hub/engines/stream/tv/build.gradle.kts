plugins {
    id("tvhub.android.library")
}

android {
    namespace = "com.tvhub.stream.tv"
}

dependencies {
    implementation(project(":core:protocol"))
    implementation(libs.webrtc.android)
}
