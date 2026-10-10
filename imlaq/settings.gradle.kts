pluginManagement {
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

rootProject.name = "Imlaq"

include(":app")
include(":core:common")
include(":core:designsystem")
include(":core:memory")
include(":core:device")
include(":core:models")
include(":engine:api")
include(":engine:host")
