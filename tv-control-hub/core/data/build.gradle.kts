plugins {
    id("tvhub.android.library")
    id("tvhub.android.hilt")
    alias(libs.plugins.room)
}
room { schemaDirectory("$projectDir/schemas") }
dependencies {
    api(project(":core:model"))
    api(project(":core:security"))
    implementation(project(":core:common"))
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    implementation(libs.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)
}
