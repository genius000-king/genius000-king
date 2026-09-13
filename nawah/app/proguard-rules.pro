# The guest-side loader reaches CmdEntryPoint by name, through app_process and a
# PathClassLoader. R8 cannot see that reference, so without this the X11 bridge
# breaks in release builds only — the worst possible way to find out.
-keep class com.termux.x11.CmdEntryPoint { *; }
-keep class com.termux.x11.MainActivity { *; }
-keep class com.termux.x11.LorieView { *; }
-keep class com.termux.x11.ICmdEntryInterface { *; }
-keep class com.termux.x11.ICmdEntryInterface$* { *; }
-keep class com.termux.x11.IRemoteCmdImterface { *; }
-keep class com.termux.x11.IRemoteCmdImterface$* { *; }

# JNI in the X server calls back into Java by name.
-keepclasseswithmembernames class * {
    native <methods>;
}

-keepclassmembers class io.nawah.linux.** {
    *** Companion;
}
-keepclasseswithmembers class io.nawah.linux.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# The X server's command-line entry point. It is never referenced from Kotlin --
# app_process names the class as a string on the command line -- so R8 has no
# reason to believe it is reachable, and a release build without this rule fails
# at run time with ClassNotFoundException and a black screen.
-keep class com.termux.x11.NawahEntryPoint { public static void main(java.lang.String[]); }
