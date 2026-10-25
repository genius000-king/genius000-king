plugins {
    id("tvhub.jvm.library")
    alias(libs.plugins.kotlin.serialization)
}
dependencies { api(libs.kotlinx.serialization.json) }
