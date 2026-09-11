package io.nawah.linux.core.runtime

import android.content.Context
import java.io.File

/**
 * Absolute paths of the executables we ship inside `nativeLibraryDir`.
 *
 * ### Why the binaries are named `lib*.so`
 * Since API 29, Android's W^X policy forbids executing any file written into the
 * app's data directory. The single remaining place an app may exec from is
 * `nativeLibraryDir`, which the installer populates from the APK's `jniLibs/`.
 * The packager only extracts entries whose names end in `.so`, so `proot`,
 * its loader and `busybox` are shipped under fake shared-library names and the
 * real names never exist on the device. Renaming any of these breaks execution
 * on every modern device, silently, with `EACCES`.
 */
interface NativeTools {
    /** The proot binary itself (`libproot.so`). */
    val prootBinary: File

    /**
     * proot's loader stub (`libproot-loader.so`).
     *
     * proot needs to know this path through the `PROOT_LOADER` environment
     * variable: the Termux build looks for it next to itself under its build
     * time prefix, which does not exist on a non-Termux device.
     */
    val prootLoader: File

    /** busybox (`libbusybox.so`), used for the probe rootfs and for in-guest `tar`. */
    val busybox: File

    /** The directory all three live in; also what `LD_LIBRARY_PATH` must be set to. */
    val nativeLibDir: File

    /**
     * Names of the tools that are missing or not executable, in a stable order.
     *
     * Returned rather than logged because the only useful diagnostic for a user
     * whose APK was repacked or split badly is *which* file is gone.
     */
    fun missingTools(): List<String>

    /** True when every tool exists and is executable. */
    fun isComplete(): Boolean = missingTools().isEmpty()
}

/** File names, in one place, because they are a contract with the packaging step. */
internal object NativeToolNames {
    const val PROOT: String = "libproot.so"
    const val PROOT_LOADER: String = "libproot-loader.so"
    const val BUSYBOX: String = "libbusybox.so"
}

/**
 * [NativeTools] rooted at an arbitrary directory.
 *
 * Exists so the runtime can be exercised on a JVM — tests and the desktop-side
 * dry runs point it at a scratch directory — without an Android [Context].
 */
class PathNativeTools(override val nativeLibDir: File) : NativeTools {
    override val prootBinary: File = File(nativeLibDir, NativeToolNames.PROOT)
    override val prootLoader: File = File(nativeLibDir, NativeToolNames.PROOT_LOADER)
    override val busybox: File = File(nativeLibDir, NativeToolNames.BUSYBOX)

    override fun missingTools(): List<String> =
        listOf(prootBinary, prootLoader, busybox)
            .filterNot { it.exists() && it.canExecute() }
            .map { it.name }
}

/**
 * The real thing: resolves the tools inside the installed APK's native library
 * directory.
 *
 * [android.content.pm.ApplicationInfo.nativeLibraryDir] is used rather than a
 * path built by hand because its value depends on the ABI the installer picked
 * and on whether the app was installed as a split — neither of which is
 * knowable at build time.
 */
class AndroidNativeTools(context: Context) : NativeTools {
    private val delegate = PathNativeTools(File(context.applicationInfo.nativeLibraryDir))

    override val nativeLibDir: File get() = delegate.nativeLibDir
    override val prootBinary: File get() = delegate.prootBinary
    override val prootLoader: File get() = delegate.prootLoader
    override val busybox: File get() = delegate.busybox

    override fun missingTools(): List<String> = delegate.missingTools()
}
