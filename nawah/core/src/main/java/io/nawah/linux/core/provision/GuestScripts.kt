package io.nawah.linux.core.provision

import io.nawah.linux.core.model.DesktopSpec
import io.nawah.linux.core.model.ResourceProfile

/**
 * The two scripts that live inside the guest filesystem.
 *
 * They are generated rather than shipped because both embed this build's
 * application id, and one of them is the load-bearing half of the X11 bridge.
 */
object GuestScripts {

    const val LOADER_PATH = "/usr/libexec/nawah-x11/loader.apk"
    const val BRIDGE_PATH = "/usr/bin/nawah-x11"
    const val SESSION_PATH = "/usr/local/bin/nawah-session"

    /**
     * Hands the X connection to the Android side.
     *
     * `app_process` is Android's own Java launcher. Running it from inside the
     * container works only because proot binds `/system`, `/apex` and
     * `/linkerconfig` -- if the desktop never appears, that is the first thing
     * to check. The loader it starts verifies the host app's signing
     * certificate before loading any of our code, which is also why a rebuild
     * with a different key needs "Repair X11 bridge".
     */
    fun bridge(applicationId: String): String = """
        #!/bin/sh
        if [ ! -e /system/bin/app_process ]; then
          echo "nawah-x11: /system/bin/app_process is not visible inside this container." >&2
          echo "nawah-x11: the session was started without the Android system bind mounts." >&2
          exit 1
        fi
        [ -z "${'$'}{LD_LIBRARY_PATH+x}" ] || export XSTARTUP_LD_LIBRARY_PATH="${'$'}LD_LIBRARY_PATH"
        [ -z "${'$'}{LD_PRELOAD+x}" ] || export XSTARTUP_LD_PRELOAD="${'$'}LD_PRELOAD"
        [ -z "${'$'}{CLASSPATH+x}" ] || export XSTARTUP_CLASSPATH="${'$'}CLASSPATH"
        export CLASSPATH=$LOADER_PATH
        unset LD_LIBRARY_PATH LD_PRELOAD
        exec /system/bin/app_process -Xnoimage-dex2oat / \
          --nice-name="nawah-x11 $applicationId ${'$'}*" com.termux.x11.Loader "${'$'}@"
    """.trimIndent() + "\n"

    /**
     * Starts the desktop.
     *
     * The X server and this script race deliberately: `CmdEntryPoint`
     * re-broadcasts its Binder once a second until the activity answers, so
     * neither side has to wait for the other.
     */
    fun session(desktop: DesktopSpec, profile: ResourceProfile, audio: Boolean): String {
        val start = desktop.startCommand.ifBlank { "/bin/bash -l" }
        val lightweight = profile != ResourceProfile.FULL
        return buildString {
            appendLine("#!/bin/bash")
            appendLine("export DISPLAY=:0")
            appendLine("export XDG_RUNTIME_DIR=/tmp")
            appendLine("export XDG_SESSION_TYPE=x11")
            appendLine("export LANG=\${LANG:-C.UTF-8}")
            if (audio) appendLine("export PULSE_SERVER=\${PULSE_SERVER:-tcp:127.0.0.1:4713}")
            if (lightweight) {
                appendLine()
                appendLine("# Resource profile: compositing off. proot cannot cap memory -- there")
                appendLine("# are no cgroups without root -- so the profile changes what actually")
                appendLine("# runs instead of pretending to enforce a limit.")
                appendLine("xfconf-query -c xfwm4 -p /general/use_compositing -s false 2>/dev/null || true")
            }
            appendLine()
            appendLine("$BRIDGE_PATH :0 &")
            appendLine("for _ in \$(seq 1 40); do")
            appendLine("  [ -e /tmp/.X11-unix/X0 ] && break")
            appendLine("  sleep 0.25")
            appendLine("done")
            appendLine()
            appendLine("exec dbus-launch --exit-with-session $start")
        }
    }
}
