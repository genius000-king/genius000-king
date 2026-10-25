plugins { id("tvhub.android.library") }
dependencies {
    testImplementation(project(":runtime:host"))
    testImplementation(project(":runtime:client"))
    testImplementation(project(":core:data"))
    testImplementation(libs.room.runtime)
    testImplementation(libs.datastore.preferences)
}
