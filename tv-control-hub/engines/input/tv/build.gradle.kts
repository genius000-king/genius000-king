plugins {
    id("tvhub.android.library")
}

android {
    namespace = "com.tvhub.input.tv"
}

dependencies {
    implementation(project(":core:protocol"))
    implementation(project(":engines:input:api"))
}
