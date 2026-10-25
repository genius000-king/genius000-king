plugins {
    id("tvhub.android.application")
    id("tvhub.android.compose")
    id("tvhub.android.hilt")
}
android {
    namespace = "com.genius.tvhub"
    defaultConfig { applicationId = "com.genius.tvhub"; versionCode = 1; versionName = "0.1.0" }
}
dependencies {
    implementation(project(":core:common"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.haze)
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.websockets)
}
