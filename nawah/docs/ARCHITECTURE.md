# Architecture

## The shape of the problem

Run a Linux distribution on an unrooted Android phone and put its desktop on
screen, from one APK. Three constraints drive every decision that follows:

1. **No root.** Containers come from `proot`, which intercepts syscalls with
   `ptrace` rather than using kernel namespaces. This is why there are no
   cgroups, and therefore no memory limits.
2. **No executing from the data directory.** Since Android 10, the only place
   an app may `exec` from is `nativeLibraryDir`. Every binary we ship is
   renamed `lib*.so` to get there.
3. **No second app.** Termux:X11 would normally provide the display. Instead
   its `lorie` module is compiled into this APK, which upstream supports
   directly.

## Modules

```
:app           Compose M3 UI, foreground services, the object graph
:core          pure logic: model, probe, runtime, provision, store, oci
:lorie         the X server (vendored, unmodified)
:shell-loader:stub   vendored compile-only stubs for Android internal APIs
```

`:core` has no Compose and no Activity. `:app` has no proot knowledge beyond
calling into `:core`. That split is what makes the runtime testable on a JVM.

### Why `:lorie-app` is deliberately absent

`lorie/build.gradle` finds the single application module that depends on it and
adopts that module's `applicationId`. Including upstream's own app module would
make two, and upstream's own guard fails the build — correctly. `settings.gradle.kts`
says as much where it matters.

## Data flow

**Install.** `WizardUiState` → `InstallRequest` → `InstallService` (foreground,
because this is 10–25 minutes of work) → `ProotProvisioner`:

```
OciClient pulls library/debian:trixie, verifying the digest while streaming
  → busybox tar, run through proot with --link2symlink, unpacks it
  → /etc/{resolv.conf,hosts,apt/...} written from the host side
  → apt-get install, streamed line by line to the UI
  → nawah-session written
```

**Run.** `SessionService` → `SessionLauncher`:

```
DisplayPrerequisites checks the machine has xkb-data and xfonts-base,
  installing them if an older build of the app left them out
  → X11Bridge starts the X server on the Android side, socket in <rootfs>/tmp
  → the socket is waited for, not assumed
  → proot starts the container, whose /tmp is that same directory
  → the X activity is brought up; the server re-broadcasts its Binder
    once a second until the activity answers
```

The X server runs **outside** the container. See `docs/x11-bridge.md` — that
one sentence is the subject of a post-mortem there.

## State

Machines are JSON files under `filesDir/machines/<id>/`, written atomically.
There is no database: the list is a handful of records, and a code generator
would have cost build time and a second schema to keep in sync.

```
filesDir/machines/<id>/
  rootfs/                 the Linux filesystem
  container/{shm,tmp,sysdata}/
  machine.json
  install.log
```

`container/sysdata/` holds the fake `/proc` files Android hides. proot binds
them over the real paths; the contents come verbatim from proot-distro.

## Where the difficulty actually is

Not in the UI, and not in the install pipeline. It is in three places:

- `ProotArgsBuilder` — the argv, where a missing flag produces a failure that
  looks like something else entirely.
- `tools/native/fetch.py` — the rename and re-link of the bundled ELFs.
- the X11 bridge — three processes, two of them not ours, and a signature check
  in the middle.

Each has a document of its own, and each has tests that exist specifically to
fail when someone simplifies it.

## App-owned files are refreshed on every launch

One file inside a machine's filesystem belongs to the app, not to Debian:

```
/usr/local/bin/nawah-session        the script that starts the desktop
```

`GuestFileWriter` rewrites it **every time a machine starts**, not once at
install time.

The difference is not an optimisation. Written only at install, a one-line fix
to the session script could reach an existing machine by exactly one route:
reinstalling the whole distribution. Twenty minutes and a gigabyte, to deliver
a corrected line of shell. That happened twice before it was fixed, and it is
why a user asked whether every new build meant reinstalling Linux again.

The answer has to be no. An app update must be enough, or the feedback loop is
too slow to debug anything.

There used to be two more files here — a `loader.apk` signed with our key and a
`nawah-x11` script that ran `app_process` inside the container. They are gone:
that whole mechanism never worked, and the X server is now started on the
Android side. Deleting them also removed the one genuinely fragile thing about
signing keys in this project.
