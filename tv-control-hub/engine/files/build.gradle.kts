plugins { id("tvhub.android.library") }
dependencies {
    api(project(":core:protocol"))
    implementation(project(":core:common"))
    implementation(libs.kotlinx.coroutines.android)
}
