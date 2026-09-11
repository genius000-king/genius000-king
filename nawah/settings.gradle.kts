pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// Repositories are declared in the root build.gradle.kts `allprojects` block
// rather than here: the vendored modules are evaluated as ordinary
// subprojects and a settings-level repository mode would fight that.

rootProject.name = "nawah"

include(":app")
include(":core")

// ---------------------------------------------------------------------------
// Vendored termux-x11 (GPL-3.0). The submodule is never edited: everything we
// need to change is parameterised upstream, so we only point Gradle at it.
//
// :lorie is the embedded X server. Its build.gradle finds the single
// application module that depends on it and adopts that module's
// applicationId -- which is why :app must be the only such module, and why
// upstream's own :lorie-app is deliberately NOT included here.
//
// :shell-loader:stub is referenced by :lorie under exactly that project path,
// so the path is not ours to choose. Its parent :shell-loader is pointed at an
// empty directory: mapping it onto vendor/ would make Gradle evaluate
// upstream's shell-loader/build.gradle, which reaches for :lorie-app.
// ---------------------------------------------------------------------------
include(":lorie")
project(":lorie").projectDir = file("vendor/termux-x11/lorie")

include(":shell-loader:stub")
project(":shell-loader").projectDir = file("gradle/empty/shell-loader")
project(":shell-loader:stub").projectDir = file("vendor/termux-x11/shell-loader/stub")

// Our own loader module: upstream's Loader.java sources, our application id,
// our signing certificate. Produces the loader.apk that runs inside the guest.
include(":x11-loader")
