import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Single source of truth for the NDK version, owned by :lorie. Reading it here
// keeps :app and :lorie on one CMake configuration; letting AGP pick its own
// default would compile the X server's native code twice.
apply(from = rootProject.file("vendor/termux-x11/lorie/version.gradle"))
val lorieNdkVersion = extra["termuxX11NdkVersion"] as String

android {
    namespace = "io.nawah.linux"
    compileSdk = 37
    compileSdkMinor = 1
    ndkVersion = lorieNdkVersion

    defaultConfig {
        applicationId = "io.nawah.linux"
        // Android 8.0. Above :lorie's floor of 24 deliberately: the installer
        // uses java.nio symlinks and startForegroundService, both API 26, and
        // an unpacked rootfs is made of symlinks. Claiming 24 only meant
        // crashing on a device that could never have run a desktop anyway.
        minSdk = 26
        targetSdk = 37
        versionCode = 13
        versionName = "0.5.0"

        // arm64 only: every Android device shipped since 2019 is arm64, and each
        // extra ABI roughly doubles the X server's native build time. Adding one
        // is a single line here plus a re-run of tools/native/fetch.sh.
        ndk.abiFilters += listOf("arm64-v8a")

        // Four libc calls the JDK does not expose. See cpp/nawah_pty.c.
        externalNativeBuild.cmake {
            targets("nawah_pty")
            arguments("-DANDROID_STL=none")
        }
    }

    externalNativeBuild.cmake {
        path = file("src/main/cpp/CMakeLists.txt")
        version = "3.22.1"
    }

    signingConfigs {
        // A fixed, committed debug key, so that every build of Nawah installs
        // over the previous one instead of asking the user to uninstall first
        // -- which on this app would mean deleting their machines.
        getByName("debug") {
            storeFile = rootProject.file("signing/nawah-debug.jks")
            storePassword = "nawahdebug"
            keyAlias = "nawah"
            keyPassword = "nawahdebug"
        }
        // Release signing is supplied out-of-band; see docs/release.md.
        create("release") {
            val props = Properties().apply {
                val f = rootProject.file("signing/release.properties")
                if (f.exists()) f.inputStream().use { load(it) }
            }
            val store = props.getProperty("storeFile")
            if (store != null) {
                storeFile = rootProject.file(store)
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Falls back to the debug key when signing/release.properties is
            // absent, so a release build is always producible locally.
            signingConfig = signingConfigs.getByName("release").takeIf { it.storeFile != null }
                ?: signingConfigs.getByName("debug")
        }
    }

    bundle {
        // MUST stay off. With language splits on, an App Bundle installed on an
        // English phone never downloads the Arabic resources — so the in-app
        // language switch would change the setting and nothing on screen. The
        // cost is a slightly larger download for two languages.
        language { enableSplit = false }
    }

    packaging {
        // MUST stay true. With legacy packaging off, native libraries are kept
        // compressed inside the APK and never written to nativeLibraryDir --
        // and nativeLibraryDir is the only place on Android 10+ from which an
        // app may execute a binary. No extracted libproot.so, no Linux.
        jniLibs.useLegacyPackaging = true
        resources.excludes += setOf(
            "/META-INF/{AL2.0,LGPL2.1}",
            "/META-INF/DEPENDENCIES",
            "/META-INF/LICENSE*",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions.unitTests {
        isIncludeAndroidResources = true
        isReturnDefaultValues = true
    }
}


dependencies {
    implementation(project(":core"))
    implementation(project(":lorie"))
    implementation(project(":usbserial"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.service)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
