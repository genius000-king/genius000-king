plugins {
    id("tvhub.jvm.library")
    alias(libs.plugins.kotlin.serialization)
}
dependencies {
    api(project(":core:model"))
    api(project(":core:common"))
    implementation(libs.kotlinx.serialization.cbor)
}
