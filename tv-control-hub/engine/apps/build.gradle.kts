plugins { id("tvhub.android.library") }
dependencies {
    api(project(":core:model"))
    implementation(project(":core:common"))
    api(project(":core:protocol"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.core.ktx)
}
