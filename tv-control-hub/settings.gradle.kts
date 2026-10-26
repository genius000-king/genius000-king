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
include(":engine:apps")
include(":engine:stream")
include(":engine:monitor")
include(":engine:files")
include(":engine:shell")
include(":engine:adb")
include(":runtime:host")
include(":runtime:client")
include(":feature:phone:remote")
include(":feature:phone:screen")
include(":feature:phone:device")
include(":feature:phone:apps")
include(":feature:phone:files")
include(":feature:phone:services")
include(":feature:phone:settings")
include(":feature:tv:launcher")
include(":feature:tv:system")
include(":testing:e2e")
