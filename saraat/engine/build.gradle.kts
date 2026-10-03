plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    testImplementation(libs.junit)
}

tasks.test {
    useJUnit()
    testLogging {
        events("passed", "failed", "skipped")
        showStandardStreams = true
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}

// Kernel-level lab: runs the engine against a real Linux TUN device (see tools/tun-lab).
tasks.register<JavaExec>("runLab") {
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.genius.saraat.engine.lab.LabMainKt")
    args = (project.findProperty("labArgs") as String? ?: "").split(" ").filter { it.isNotBlank() }
}

// Prints the classpath so tools/tun-lab scripts can start the lab with plain `java -cp` (fast startup).
tasks.register("printLabClasspath") {
    doLast { println("LABCP=" + sourceSets["test"].runtimeClasspath.asPath) }
}
