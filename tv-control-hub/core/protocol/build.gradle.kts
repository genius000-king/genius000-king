plugins {
    id("tvhub.jvm.library")
}

dependencies {
    api(project(":core:common"))
    implementation(libs.kotlinx.serialization.json)
}
