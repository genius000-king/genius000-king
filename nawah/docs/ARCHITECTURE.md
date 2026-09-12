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
:x11-loader    upstream Loader.java, built with our id and certificate hash
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
  → loader.apk + nawah-x11 installed into the rootfs
  → nawah-session written
```

**Run.** `SessionService` starts the X activity and the guest session at the
same time; they find each other because the guest re-broadcasts its Binder once
a second. See `docs/x11-bridge.md`.

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

Three files inside a machine's filesystem belong to the app, not to Debian:

```
/usr/libexec/nawah-x11/loader.apk   the guest half of the X11 bridge
/usr/bin/nawah-x11                  the script that execs app_process
/usr/local/bin/nawah-session        the script that starts the desktop
```

`GuestFileWriter` rewrites all three **every time a machine starts**, not once
at install time.

The difference is not an optimisation. Written only at install, a one-line fix
to the session script could reach an existing machine by exactly one route:
reinstalling the whole distribution. Twenty minutes and a gigabyte, to deliver
a corrected line of shell. That happened twice before it was fixed, and it is
why a user asked whether every new build meant reinstalling Linux again.

The answer has to be no. An app update must be enough, or the feedback loop is
too slow to debug anything.

The same call also repairs the signature mismatch case: a differently-signed
build leaves a `loader.apk` the new app cannot load, and the launch replaces it
before it matters. The loader is only rewritten when its bytes differ, so the
check costs nothing on an ordinary start.
