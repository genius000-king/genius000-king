package com.termux.x11;

import android.os.Looper;
import android.util.Log;

import androidx.annotation.Keep;

/**
 * Our own command-line entry point for the X server.
 *
 * <p>It exists because of a single incompatible line in {@code
 * CmdEntryPoint.initEntryPoint()}:
 *
 * <pre>
 *   String path = "lib/" + Build.SUPPORTED_ABIS[0] + "/libXlorie.so";
 *   URL res = loader.getResource(path);
 *   System.load(res.getFile().replace("file:", ""));
 * </pre>
 *
 * <p>That resolves to {@code /data/app/…/base.apk!/lib/arm64-v8a/libXlorie.so}
 * and only works when the library is <em>stored uncompressed and aligned</em>
 * inside the APK — which is why upstream sets {@code
 * jniLibs.useLegacyPackaging false}.
 *
 * <p>We cannot. proot, its loader and busybox must be <em>extracted to disk</em>
 * in {@code nativeLibraryDir}, because since API 29 that is the only directory
 * an app may execute a binary from, and extraction is exactly what legacy
 * packaging means. The two requirements are opposites, and upstream's wins only
 * if we give up running Linux at all.
 *
 * <p>So the load is done here instead, from the absolute path of the already
 * extracted library, and the rest of upstream's startup is replayed verbatim.
 * Calling {@code CmdEntryPoint.main} would defeat this: it would try the
 * in-APK path first and {@code System.exit(134)} on failure.
 *
 * <p>Written in Java rather than Kotlin deliberately — {@code
 * CmdEntryPoint.handler} and its constructor are package-private, and this
 * class is a member of their package.
 */
@Keep
public final class NawahEntryPoint {

    /** Absolute path of {@code libXlorie.so}; set by {@code X11Bridge}. */
    public static final String LIBRARY_ENV = "NAWAH_XLORIE";

    private NawahEntryPoint() {
    }

    public static void main(String[] args) {
        String library = System.getenv(LIBRARY_ENV);
        if (library == null || library.isEmpty()) {
            System.err.println("nawah: " + LIBRARY_ENV + " is not set; cannot locate libXlorie.so");
            System.exit(2);
            return;
        }

        try {
            System.load(library);
        } catch (Throwable t) {
            Log.e("NawahX11", "failed to dlopen " + library, t);
            System.err.println("nawah: could not load " + library + ": " + t);
            // 134 is upstream's code for this failure; keep it, the log reader
            // and the documentation both refer to it.
            System.exit(134);
            return;
        }

        // Replays CmdEntryPoint.main from here on. Touching `ctx` runs the
        // class initialiser, which prepares the main Looper and the handler.
        CmdEntryPoint.ctx = CmdEntryPoint.createContext();
        CmdEntryPoint.handler.post(() -> new CmdEntryPoint(args));
        Looper.loop();
    }
}
