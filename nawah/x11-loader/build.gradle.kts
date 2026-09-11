import java.security.KeyStore
import java.util.Properties

// The guest-side loader. Upstream's Loader.java, compiled against *our*
// application id and *our* signing certificate.
//
// This APK is never installed. It is copied into the Linux rootfs and run by
// /system/bin/app_process with CLASSPATH pointing at it; it then verifies the
// host app's signature and hands control to com.termux.x11.CmdEntryPoint
// inside our own APK. Sources come straight from the pristine submodule --
// nothing in vendor/ is edited.

plugins {
    alias(libs.plugins.android.application)
}

/** Hash Android's Signature class will produce for the certificate we sign with. */
fun signingCertificateHash(): Int {
    val props = Properties().apply {
        val f = rootProject.file("signing/release.properties")
        if (f.exists()) f.inputStream().use { load(it) }
    }
    val storePath = props.getProperty("storeFile") ?: "signing/nawah-debug.jks"
    val storePass = props.getProperty("storePassword") ?: "nawahdebug"
    val alias = props.getProperty("keyAlias") ?: "nawah"

    val ks = KeyStore.getInstance(KeyStore.getDefaultType())
    rootProject.file(storePath).inputStream().use { ks.load(it, storePass.toCharArray()) }
    val cert = requireNotNull(ks.getCertificate(alias)) {
        "alias '$alias' not found in $storePath"
    }
    // android.content.pm.Signature.hashCode() is Arrays.hashCode(rawCertBytes).
    return cert.encoded.contentHashCode()
}

val hostApplicationId = "io.nawah.linux"

android {
    namespace = "com.termux.x11.shell_loader"
    compileSdk = 37
    compileSdkMinor = 1

    sourceSets.getByName("main") {
        java.setSrcDirs(listOf(rootProject.file("vendor/termux-x11/shell-loader/src/main/java")))
        manifest.srcFile("src/main/AndroidManifest.xml")
        res.setSrcDirs(emptyList<String>())
        assets.setSrcDirs(emptyList<String>())
    }

    defaultConfig {
        minSdk = 24
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "APPLICATION_ID", "\"$hostApplicationId\"")
        buildConfigField("String", "EMBEDDED_APPLICATION_ID", "\"$hostApplicationId\"")
        buildConfigField("String", "logTag", "\"Nawah X11 loader\"")
        buildConfigField("int", "SIGNATURE", signingCertificateHash().toString())
        buildConfigField("String", "CLASS_ID", "\"com.termux.x11.CmdEntryPoint\"")
        buildConfigField("String", "COMMIT", "\"${System.getenv("CURRENT_COMMIT") ?: "local"}\"")
        buildConfigField(
            "String", "packageNotInstalledErrorText",
            "\"The Nawah application was not found on this device.\\n\" +\n" +
                "        \"The X11 bridge can only run from inside the app that installed this machine.\\n\"",
        )
        buildConfigField(
            "String", "packageSignatureMismatchErrorText",
            "\"Signature check failed for $hostApplicationId.\\n\" +\n" +
                "        \"This machine's X11 bridge was installed by a differently-signed build of Nawah.\\n\" +\n" +
                "        \"Open the machine's settings and run 'Repair X11 bridge'.\"",
        )
    }

    buildTypes.getByName("debug") {
        isMinifyEnabled = false
    }

    buildFeatures.buildConfig = true

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidComponents {
        onVariants(selector().all()) { variant ->
            variant.outputs.forEach { it.outputFileName.set("loader.apk") }
        }
    }
}

dependencies {
    compileOnly(project(":shell-loader:stub"))
}
