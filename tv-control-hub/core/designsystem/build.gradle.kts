plugins {
    id("tvhub.android.library")
    id("tvhub.android.compose")
    alias(libs.plugins.roborazzi)
}
dependencies {
    api(libs.haze)
    api(libs.tv.material)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.roborazzi.junit.rule)
}
