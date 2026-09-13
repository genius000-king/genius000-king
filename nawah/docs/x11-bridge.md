# The X11 bridge

This is the least obvious part of the app and the one that fails in the most
confusing ways. It is worth reading before changing anything near it.

## What has to happen

An X client inside a Debian container has to draw onto an Android surface.
There is no shared display server between the two worlds and no network
involved — the connection is a file descriptor passed across a Binder call.

## Where the X server runs

**Outside the container.** This is the single most important fact on this page,
and getting it wrong cost three releases. Upstream's README says it plainly:

> Example, run in a Termux shell (**not inside the proot container**):
> ```
> termux-x11 :1 &
> proot-distro login ubuntu --shared-tmp
> ```

The X server is an Android process. proot is a ptrace sandbox for *Linux*
binaries; putting an Android runtime inside it does not make the runtime more
available, it makes it unusable. Our version is simpler than Termux's, because
we do not need `--shared-tmp` at all: the server writes its socket into
`<rootfs>/tmp`, which **is** the container's `/tmp`. Nothing is bound, nothing
is shared, both sides are looking at one directory on disk.

## The handshake

```
 Android side                                  Debian side (inside proot)
 ────────────                                  ──────────────────────────
 SessionService.start(machine)
      │
      ├─► X11Bridge.start(rootfs, ":0")
      │     /system/bin/app_process -Xnoimage-dex2oat /
      │        --nice-name=nawah-x11
      │        com.termux.x11.NawahEntryPoint :0
      │     CLASSPATH   = our own APK
      │     TMPDIR      = <rootfs>/tmp
      │     NAWAH_XLORIE= <nativeLibDir>/libXlorie.so
      │          │
      │          ├─ System.load(NAWAH_XLORIE)
      │          ├─ CmdEntryPoint.ctx = createContext()
      │          └─ new CmdEntryPoint(":0")
      │                 └─ binds <rootfs>/tmp/.X11-unix/X0
      │
      ├─► X11Bridge.awaitSocket(":0")   ← waits for that socket
      │
      ├─► ProotRunner.stream(...) ──────────►  /usr/local/bin/nawah-session
      │                                              │  waits for /tmp/.X11-unix/X0
      │                                              │  (the same file)
      │                                              │
      └─► SessionLauncher.openDisplay()              │
            com.termux.x11.MainActivity              │
                    ▲                                │
 LorieBroadcastReceiver ◄── ACTION_START ────────────┤ the server re-broadcasts its
            │                                        │ ICmdEntryInterface Binder once
            ▼                                        │ a second until the activity answers
 MainActivity.onReceiveConnection()                  │
   service.getXConnection() ──► ParcelFileDescriptor │
   LorieView.connect(fd)                             │
                                                     └─► dbus-launch startxfce4
```

The server and the activity do **not** need sequencing — that is what the
once-a-second rebroadcast is for. The server and the *container* do: the
session script would otherwise start clients against a display that is not
listening yet, so it waits for the socket and says so if it never appears.

## Why we cannot use `CmdEntryPoint.main`

Upstream's entry point loads its own native library from inside the APK:

```java
String path = "lib/" + Build.SUPPORTED_ABIS[0] + "/libXlorie.so";
URL res = loader.getResource(path);
System.load(res.getFile().replace("file:", ""));   // /data/app/…/base.apk!/lib/…
```

That works only when the library is stored **uncompressed and page-aligned**
inside the APK, which is why `lorie/build.gradle` sets
`jniLibs.useLegacyPackaging false`.

We must set it `true`. Since API 29, Android will execute a binary only from
`nativeLibraryDir`, and legacy packaging is precisely the switch that extracts
`lib*.so` there. Without it `libproot.so` is never written to disk and there is
no Linux to display at all. The two requirements are opposites and ours wins.

So `com.termux.x11.NawahEntryPoint` (in `app/src/main/java/com/termux/x11/`)
replaces `initEntryPoint`: it loads the already-extracted library by absolute
path, then replays upstream's startup verbatim. It is written in Java because
`CmdEntryPoint.handler` and its constructor are package-private.

Symptom if this is ever broken: the session log says
`the display server exited with status 134`.

## The environment and argv that decide everything

| Setting | Value | What breaks without it |
|---|---|---|
| `TMPDIR` | `<rootfs>/tmp` | the socket lands somewhere the container cannot see, and the session times out after 20s |
| `NAWAH_XLORIE` | `<nativeLibDir>/libXlorie.so` | status 134, "could not load" |
| `XKB_CONFIG_ROOT` | `<rootfs>/usr/share/X11/xkb` | the server exits: "$XKB_CONFIG_ROOT is not set" |
| `-fp` | the `usr/share/fonts/X11/*` directories that have a `fonts.dir` | the server aborts: "could not open default font" |

`TMPDIR` does a second job that is easy to miss. The X server treats
`dirname($TMPDIR)` as the container root and derives two paths from it
(`cmdentrypoint.cpp`, the branch commented "chroot case"):

* `XKB_CONFIG_ROOT` → `<root>/usr/share/X11/xkb`. **Without a keyboard map the
  server refuses to start**, and the user sees a black screen.
* the default font path → `<root>/usr/share/fonts/X11`.

Pointing `TMPDIR` at `<rootfs>/tmp` therefore places the socket and the keymap
correctly in one move, and `X11LaunchPlan` sets `XKB_CONFIG_ROOT` explicitly on
top of that, saying so in the log when the directory is not there.

The font half of that search is **not** trusted, and this is worth spelling
out. The server tries `<root>/etc/X11/fonts` before `<root>/usr/share/fonts/X11`.
On Debian the first one exists — `xfonts-base` ships alias *sources* there —
but it has no `fonts.dir` and no readable font, so the search succeeds and
yields a font path the server cannot use. It then aborts with

```
Fatal server error: could not open default font
```

which arrives in the app as a black screen. `X11LaunchPlan` passes `-fp` with
the directories that actually carry a `fonts.dir`, which overrides the search
entirely.

## Packages the display server cannot start without

Two, and neither failure names a package:

| Package | Without it |
|---|---|
| `xkb-data` | `$XKB_CONFIG_ROOT is not set`, server exits |
| `xfonts-base` | `could not open default font`, server aborts |

Both are in `ProotProvisioner.BASE_PACKAGES`, and both are **re-checked at every
launch** by `DisplayPrerequisites`. A machine installed by an older build of the
app is missing them, and the only acceptable answer to eight missing megabytes
is one `apt-get install`, not reinstalling a gigabyte of Debian. `SessionLauncher`
runs that install before starting the server and refuses to start the server if
it fails — a black screen with no explanation is worse than an error.

## Why `--bind=/system` is still load-bearing

`app_process` no longer runs inside the container, so the binds are not needed
*for the bridge* any more. They stay because a Debian desktop reaches for
Android's graphics and device nodes through `/dev`, `/proc`, `/sys`, `/apex`,
`/system` and `/linkerconfig` in several places, and because removing them has
never been the thing that fixed anything. If you are tempted to trim the list
for isolation, don't.

## Files involved

| File | Role |
|---|---|
| `app/.../com/termux/x11/NawahEntryPoint.java` | loads `libXlorie.so` from disk, then upstream's startup |
| `app/.../session/X11LaunchPlan.kt` | the argv and environment, as a pure function |
| `core/.../provision/DisplayPrerequisites.kt` | the packages and the font path, checked at every launch |
| `app/.../session/X11Bridge.kt` | starts, watches and stops the server process |
| `app/.../session/SessionLauncher.kt` | orders the three parts and owns the lifetime |
| `core/.../provision/GuestScripts.kt` | generates `nawah-session` |
| `core/.../runtime/ProotArgsBuilder.kt` | the bind list |
| `vendor/termux-x11/lorie` | the X server itself (never edited) |

## Debugging checklist

The session log (Diagnostics → session log, or `machines/<id>/session.log`)
carries both sides, interleaved. Read it top to bottom.

| Line | Meaning |
|---|---|
| `the display server exited with status 134` | `libXlorie.so` did not load — see above |
| `$XKB_CONFIG_ROOT is not set` | the machine has no `xkb-data` package |
| `no keyboard map in the machine` | same, caught before the server starts |
| `could not open default font` | `xfonts-base` is missing or unconfigured |
| `xfonts-base is missing — …` | the launch caught it and is installing it |
| `the display server did not create its socket` | the server died during startup; its own output is directly above |
| `no X socket at /tmp/.X11-unix/X0 after 20s` | the container cannot see the socket — `TMPDIR` and the rootfs have diverged |
| `<command> is not installed in this system` | the desktop package set never finished installing |

---

## Post-mortem: the first on-device run

The first build reached a device and failed. It is worth writing down, because
the code that replaced it exists in the shape it does for these reasons.

The log said, in order:

```
proot error: '/data/app/…/lib/arm64/libbusybox.so'
wrote resolv.conf, hosts, sources.list, apt config
proot error: '/bin/sh' not found (root = …/rootfs)
fatal error: see `libproot.so --help`.
```

**Cause.** The installer unpacked the image by running busybox *through proot*
and passed busybox's host path as the command. proot resolves the command it
is given **inside the guest rootfs** — which, at that moment, was empty. The
extraction never happened.

**What made it much worse.** The pipeline collected each command's output but
never looked at its exit code. So a step that had done nothing at all was
marked complete, and the installer walked on through `apt-get update` into an
empty filesystem. The user watched five green ticks accumulate over work that
had not occurred.

**Fixes, and what each one prevents:**

| Fix | Prevents |
|---|---|
| `RootfsExtractor` unpacks on the Android side | the whole class of "guest path vs host path" errors — there is no guest yet at extraction time |
| `ProotRunner.exec()` returns the exit code, and `runGuestChecked` throws on non-zero | a failed step ever being reported as done |
| the installer asserts `/bin/sh` exists after extraction | reaching `apt` with an unusable rootfs |
| `InstallService` publishes the terminal state on cancel | the screen freezing on its last frame, which read as "Cancel does nothing" |
| `withContext(NonCancellable)` around the failure write | a cancelled install staying recorded as INSTALLING for ever |

The general lesson is the second row. Streaming output is not the same as
checking a result, and a progress UI that derives its ticks from "the step was
reached" rather than "the step succeeded" will lie confidently.

## Post-mortem: the crash at step 5

The install reached "Configuring base system" and the process died, twice.
Android reported it as a bug in the app, which it was.

**Cause.** `ProotProvisioner.install` was a `flow { }`. `ProotRunner.exec` reads
the child's output inside its own `withContext(Dispatchers.IO)` and calls back
per line, and the installer's callback emitted progress. That emission happens
in a *different coroutine* than the flow builder, which `flow {}` forbids:

```
IllegalStateException: Flow invariant is violated:
  Emission from another coroutine is detected.
```

It is not a dispatcher question — the flow already ran on IO — it is the Job
that differs. And the failure could only appear at step 5, because that is the
first step whose output comes back through the runner rather than being emitted
directly from the builder. Everything before it emitted from the right place.

**Why it killed the process rather than showing an error.** The exception left
`exec`, left `runGuestChecked`, and reached the installer's own catch — which
tried to `emit` a Failed state, on a collector that was already poisoned. That
threw again, escaped `collect`, and landed in a `launch` with no exception
handler. An exception escaping a launched coroutine takes the process with it.

**Fixes:**

| Fix | Prevents |
|---|---|
| `install()` is a `channelFlow` and sends rather than emits | the invariant violation; channelFlow exists for concurrent emission |
| both services carry a `CoroutineExceptionHandler` | *any* future escape becoming a crash instead of a Failed state |
| `CrashLog` surfaces the last uncaught exception in Diagnostics | the next report being "it closed by itself" instead of a stack trace |

`FlowEmissionContextTest` pins all three: it reproduces the violation, shows
channelFlow accepting the same emission, and exercises the runner-callback
shape end to end.

The general lesson, again the second row: the bug was one line, but what made
it a crash instead of a message was the absence of a handler. A long-running
service should never be one unhandled exception away from taking the app down,
whatever the bug turns out to be.

## Post-mortem: the X server inside the container

Three releases in a row shipped an X11 bridge that ran `app_process` **inside**
proot. The last of them produced the clearest possible evidence and was still
easy to misread:

```
nawah: the bridge exited with status 0
```

Status 0. A success. It had started nothing, drawn nothing, and bound no
socket — and because the exit code was zero, every check in the pipeline was
satisfied.

**Cause.** proot is a ptrace sandbox for Linux binaries. `app_process` is the
Android runtime launcher; under ptrace, with a rewritten filesystem view and a
different linker namespace, it exits immediately. The design was never
upstream's: their README starts the server *in a Termux shell* and only then
enters the container.

**What had to change:**

| Change | Why |
|---|---|
| `X11Bridge` starts the server on the Android side | ptrace is not a place to run an Android runtime |
| `TMPDIR = <rootfs>/tmp` | the socket lands in the container's own `/tmp`; no bind, and `dirname` finds the keymap and fonts |
| `NawahEntryPoint` loads `libXlorie.so` by path | upstream loads it from inside the APK, which our packaging makes impossible |
| the session script waits for the socket instead of starting the server | it has one job now, and it can explain failing at it |
| `loader.apk`, `nawah-x11`, `:x11-loader` deleted | the guest half of the bridge no longer exists, and dead code that claims to be load-bearing is how this was misread for three releases |
| `X11LaunchPlanTest` asserts the argv and the environment | every one of these failures was a wrong entry in one of those two lists |

**The general lesson.** Two of the three releases were spent debugging *inside*
the wrong architecture — better logging, better error messages, more careful
sequencing — when upstream's README had a two-line example contradicting the
whole approach. Read the project you are vendoring before instrumenting your
misuse of it.
