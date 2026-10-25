plugins {
    id("tvhub.android.feature")
    alias(libs.plugins.roborazzi)
}
dependencies {
    implementation(project(":runtime:client"))
}
