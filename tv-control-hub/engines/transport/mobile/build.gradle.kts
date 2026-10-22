plugins {
    id("tvhub.android.library")
}

android {
    namespace = "com.tvhub.transport.mobile"
}

dependencies {
    api(project(":core:protocol"))
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.client.websockets)
}
