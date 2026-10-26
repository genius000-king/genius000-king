plugins { id("tvhub.android.library") }
dependencies {
    implementation(project(":core:common"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.dadb)
}
