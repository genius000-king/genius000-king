package com.genius.imlaq.engine.host

import android.content.Context
import java.io.File

/**
 * The engine executables inside the APK. Android only lets an app execute files from its
 * nativeLibraryDir, and only extracts files named `lib*.so` there — hence the names.
 * scripts/build-native.sh builds and stages them.
 */
enum class Runner(val fileName: String) {
    /** BigMoeOnEdge's bmoe-cli: text models, MoE streamed from flash, dense via mmap. */
    TEXT("libimlaq_text.so"),

    // Planned (docs/PLAN.md): each one a runner of its own, speaking docs/PROTOCOL.md.
    SPEECH_TO_TEXT("libimlaq_stt.so"),
    TEXT_TO_SPEECH("libimlaq_tts.so"),
    IMAGE("libimlaq_image.so"),
}

class RunnerBinaries(context: Context) {

    val libraryDir = File(context.applicationInfo.nativeLibraryDir)

    fun executable(runner: Runner) = File(libraryDir, runner.fileName)

    fun isPackaged(runner: Runner) = executable(runner).canExecute()
}
