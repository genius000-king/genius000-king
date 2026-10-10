plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.genius.imlaq"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.genius.imlaq"
        minSdk = 29
        targetSdk = 37
        versionCode = 3
        versionName = "0.3.0"
        ndk { abiFilters += "arm64-v8a" }
    }

    // One fixed key for every debug build, here and in CI: a new APK installs over the old one
    // instead of forcing an uninstall, which would delete the downloaded models with the app.
    // It is public on purpose and only for debug builds; a store release gets its own private key.
    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("keystore/imlaq-debug.keystore")
            storePassword = "imlaq-debug"
            keyAlias = "imlaq"
            keyPassword = "imlaq-debug"
        }
    }

    buildTypes {
        release {
            // R8 shrinks the unused library code (most of a Compose app's size) and resources.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Same key as debug builds for now, so either installs over the other.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures { compose = true }

    // Robolectric renders the real Compose UI on the JVM (screenshot test, no emulator needed).
    testOptions { unitTests.isIncludeAndroidResources = true }

    // The engines are real executables shipped as lib*.so. Android only lets an app exec files
    // from its nativeLibraryDir, and only extracts them there when packaging is legacy.
    packaging {
        jniLibs { useLegacyPackaging = true }
    }
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:device"))
    implementation(project(":core:models"))
    implementation(project(":engine:host"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.work.runtime.ktx)

    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
}
