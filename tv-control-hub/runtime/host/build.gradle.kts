plugins {
    id("tvhub.android.library")
    id("tvhub.android.hilt")
}
dependencies {
    api(project(":core:transport"))
    api(project(":core:data"))
    implementation(project(":core:common"))
    implementation(project(":core:discovery"))
    api(project(":engine:input"))
    api(project(":engine:apps"))
    api(project(":engine:stream"))
    api(project(":engine:monitor"))
    api(project(":engine:files"))
    api(project(":engine:shell"))
    api(project(":engine:adb"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.service)
}
