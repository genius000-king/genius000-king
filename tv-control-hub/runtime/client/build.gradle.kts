plugins {
    id("tvhub.android.library")
    id("tvhub.android.hilt")
}
dependencies {
    api(project(":core:transport"))
    api(project(":core:data"))
    api(project(":core:discovery"))
    implementation(project(":core:common"))
    implementation(libs.kotlinx.coroutines.android)
}
