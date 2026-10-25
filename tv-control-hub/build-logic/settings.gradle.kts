dependencyResolutionManagement {
    repositories {
        google()
        // Google's mirror of Maven Central first: Central rate-limits busy CI hosts (HTTP 429).
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
    versionCatalogs {
        create("libs") { from(files("../gradle/libs.versions.toml")) }
    }
}
rootProject.name = "build-logic"
include(":convention")
