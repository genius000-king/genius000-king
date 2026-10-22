pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "tv-control-hub"

include(":core:common")
include(":core:protocol")
include(":core:design")

include(":engines:input:api")
include(":engines:input:tv")
include(":engines:transport:tv")
include(":engines:transport:mobile")
include(":engines:stream:tv")
include(":engines:stream:mobile")
include(":engines:monitor:tv")

include(":apps:hub")
