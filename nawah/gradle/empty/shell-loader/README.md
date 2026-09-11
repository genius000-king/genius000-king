Intentionally empty.

`:lorie` depends on `:shell-loader:stub` by that exact project path, so Gradle
needs a `:shell-loader` parent project to hang it from. Pointing that parent at
the vendored directory would make Gradle evaluate upstream's
`shell-loader/build.gradle`, which reaches for `:lorie-app` — a module we
deliberately do not include (see settings.gradle.kts). So the parent gets this
empty directory instead, and only the `stub` child is mapped into vendor/.
