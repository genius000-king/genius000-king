pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        // Google's mirror of Maven Central first: Central rate-limits busy CI hosts (HTTP 429).
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        // Google's mirror of Maven Central first: Central rate-limits busy CI hosts (HTTP 429).
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
    }
}

rootProject.name = "tv-control-hub"

include(":app")
include(":core:common")
include(":core:model")
include(":core:protocol")
include(":core:security")
include(":core:transport")
include(":core:designsystem")
include(":core:data")
include(":core:discovery")
include(":engine:input")
include(":feature:phone:remote")
include(":feature:tv:launcher")
