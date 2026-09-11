# The X11 bridge

This is the least obvious part of the app and the one that fails in the most
confusing ways. It is worth reading before changing anything near it.

## What has to happen

An X client inside a Debian container has to draw onto an Android surface.
There is no shared display server between the two worlds and no network
involved — the connection is a file descriptor passed across a Binder call.

## The handshake

```
 Android side                                  Debian side (inside proot)
 ────────────                                  ──────────────────────────
 SessionService.start(machine)
      │
      ├─► SessionLauncher.openDisplay()
      │     starts com.termux.x11.MainActivity
      │     (from the vendored :lorie module —
      │      this activity *is* the X server)
      │
      └─► ProotRunner.stream(...)  ───────────►  /usr/local/bin/nawah-session
                                                       │
                                                       ├─► /usr/bin/nawah-x11 :0
                                                       │      CLASSPATH=/usr/libexec/nawah-x11/loader.apk
                                                       │      exec /system/bin/app_process … com.termux.x11.Loader
                                                       │
                                                       │   Loader.main()
                                                       │     1. looks up package io.nawah.linux
                                                       │     2. checks its signing certificate
                                                       │        against a hash compiled into itself
                                                       │     3. PathClassLoader(host apk)
                                                       │     4. CmdEntryPoint.main()
                                                       │
      LorieBroadcastReceiver  ◄──── ACTION_START ───────┤   broadcasts an ICmdEntryInterface Binder,
              │                                         │   re-sending once a second until answered
              ▼                                         │
      MainActivity.onReceiveConnection()                │
        service.getXConnection() ──► ParcelFileDescriptor
        LorieView.connect(fd)                           │
                                                        └─► dbus-launch startxfce4
```

Because `CmdEntryPoint` keeps re-broadcasting, the two halves do not have to be
started in order. `SessionService` fires both and lets them find each other.

## Why `--bind=/system` is load-bearing

Step three execs `/system/bin/app_process` **from inside the container**. proot
shows the guest only what it is told to bind, so without

```
--bind=/system  --bind=/apex  --bind=/vendor  --bind=/linkerconfig/ld.config.txt
```

that path does not exist, `nawah-x11` exits, and the desktop never appears —
with nothing in the log but "not found". `ProotArgsBuilder` adds these for every
session and the comment there says so. If you are ever tempted to trim the bind
list for isolation, this is the line that breaks.

## The signature trap

`Loader` verifies the host app's signing certificate against
`BuildConfig.SIGNATURE`, a hash baked into `loader.apk` at build time by
`x11-loader/build.gradle.kts`. This is a real security property: the loader
runs before any of our code and refuses to load a replaced APK.

The consequence is easy to hit during development. `loader.apk` lives **inside
each machine's rootfs**, copied there at install time. Rebuild the app with a
different signing key and every already-installed machine still holds a loader
that trusts the *old* certificate — so X stops starting, and only for existing
machines.

The fix is `Provisioner.repairX11Bridge(machineId)`, surfaced in the UI as
**Repair X11 bridge**: it re-copies `loader.apk` and rewrites
`/usr/bin/nawah-x11`. This is why the debug keystore at `signing/nawah-debug.jks`
is committed rather than generated — a per-machine debug key would break the
bridge on every clean checkout.

## Files involved

| File | Role |
|---|---|
| `x11-loader/build.gradle.kts` | builds `loader.apk` with our id and certificate hash |
| `core/.../provision/GuestScripts.kt` | generates `nawah-x11` and `nawah-session` |
| `core/.../provision/ProotProvisioner.kt` | installs both into the rootfs |
| `core/.../runtime/ProotArgsBuilder.kt` | the bind list that makes `app_process` reachable |
| `app/.../session/SessionLauncher.kt` | starts the activity and the guest session |
| `vendor/termux-x11/lorie` | the X server itself (unmodified) |

## Debugging checklist

1. `adb logcat -s "Nawah X11 loader"` — the loader's own messages, including
   signature failures.
2. Run `nawah-x11 :0` by hand from the app's terminal. "app_process is not
   visible" means the bind list; a signature message means run the repair.
3. `adb logcat -s NawahSession` — the guest session's stdout.
