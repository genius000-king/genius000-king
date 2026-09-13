plugins {
    alias(libs.plugins.android.library)
}

/**
 * The vendored USB-serial drivers, built with our own configuration.
 *
 * The sources come from `vendor/usb-serial` (MIT, mik3y/usb-serial-for-android)
 * and are never edited. Its own `build.gradle` is not used: it pins an older
 * compileSdk and carries a publishing block this project has no use for, and
 * adopting a second build configuration is how a toolchain upgrade starts
 * failing in a module nobody owns.
 *
 * So the module is ours and the code is theirs — the same arrangement as the
 * vendored X server, minus the native build.
 *
 * `src/main/java` is a symlink into the submodule rather than a `sourceSets`
 * override: AGP 9's library source-set DSL cannot be reassigned from Kotlin
 * (`DefaultAndroidLibrarySourceSet_Decorated cannot be cast to
 * AndroidLibrarySourceSet`), and a symlink says the same thing without
 * depending on a build API that has already changed once.
 */
android {
    namespace = "com.hoho.android.usbserial"
    compileSdk = 37
    compileSdkMinor = 1

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.annotation)
}
