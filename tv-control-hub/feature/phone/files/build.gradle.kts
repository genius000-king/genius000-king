plugins { id("tvhub.android.feature") }
dependencies {
    implementation(project(":runtime:client"))
    implementation(libs.androidx.activity.compose)
}
