plugins {
    id("tvhub.android.library")
}

android {
    namespace = "com.tvhub.monitor.tv"
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:protocol"))
    implementation(libs.kotlinx.coroutines.core)
}
