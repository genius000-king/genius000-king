plugins {
    id("tvhub.android.application")
    id("tvhub.android.compose")
    id("tvhub.android.hilt")
}

android {
    namespace = "com.genius.tvhub"
    defaultConfig {
        applicationId = "com.genius.tvhub"
        versionCode = 1
        versionName = "0.1.0"
        // One APK for phone and TV: both common ABIs of real devices.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Signed with the debug key unless a release key is configured: installable as-is.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    packaging {
        resources.excludes += setOf("META-INF/INDEX.LIST", "META-INF/io.netty.versions.properties", "META-INF/*.kotlin_module", "META-INF/DEPENDENCIES")
    }
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:model"))
    implementation(project(":core:designsystem"))
    implementation(project(":core:data"))
    implementation(project(":runtime:host"))
    implementation(project(":runtime:client"))
    implementation(project(":feature:tv:launcher"))
    implementation(project(":feature:tv:system"))
    implementation(project(":feature:phone:remote"))
    implementation(project(":feature:phone:screen"))
    implementation(project(":feature:phone:device"))
    implementation(project(":feature:phone:apps"))
    implementation(project(":feature:phone:files"))
    implementation(project(":feature:phone:services"))
    implementation(project(":feature:phone:settings"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.profileinstaller)
}
