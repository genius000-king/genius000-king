plugins {
    id("tvhub.android.library")
}

android {
    namespace = "com.tvhub.transport.tv"
}

dependencies {
    api(project(":core:protocol"))
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.websockets)
}
