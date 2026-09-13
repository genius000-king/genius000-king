# Working on Nawah

Rules that were learned by breaking something, and the reason each one exists.
Read them before touching the areas they name; every one of them cost a release.

## Never

**Never edit anything under `vendor/`.** Both submodules are upstream code we
carry unchanged: `vendor/termux-x11` (the X server) and `vendor/usb-serial` (the
serial drivers). Everything we need to change is parameterised from outside. If
something seems to require an edit there, the answer is a wrapper module —
`:usbserial` is what that looks like.

**Never set `jniLibs.useLegacyPackaging = false`.** Since API 29 an app may
execute a binary only from `nativeLibraryDir`, and legacy packaging is what
puts it there. Turn it off and `libproot.so` is never extracted: no proot, no
Linux. Upstream's X server sets it to `false` for its own reasons — see
`app/src/main/java/com/termux/x11/NawahEntryPoint.java` for how the two are
reconciled.

**Never remove a bind from `ProotArgsBuilder` to tidy it up.** Each one is load
bearing and most of them are non-obvious. `/system`, `/apex` and
`/linkerconfig` in particular are what make a Debian desktop able to reach
Android's graphics at all.

**Never hand-commit a native binary.** Run `tools/native/fetch.py`; the versions
and hashes are pinned in `native.lock.json` and `native-verify.yml` checks that
the result is reproducible.

**Never write a fixed pixel size into the X server's display settings.**
`displayResolutionMode` has four values and only `native` and `scaled` can be
right on an arbitrary phone. `exact` and `custom` pin a resolution, which on a
19.5:9 panel means black bars and an upscaled, blurry desktop. This shipped.

**Never let a missing optional package stop a session.** The display's packages
are fatal; sound is not. Treating them alike meant a machine with audio enabled
and no `pulseaudio` could not open a desktop at all.

## Always

**Test a generated program by running it.** `GuestScripts` produces bash, and
six string assertions about a script's contents were all green while the script
died at line 19 on every launch. `GuestScriptExecutionTest` and `UsbHelperTest`
run the real thing under real bash.

**Check a package name against the real archive.** `xkeyboard-config` is the
*source* package; the binary is `xkb-data`, and that broke every install. On
Ubuntu, `firefox` and `chromium-browser` are transitional packages that pull a
snap, and snaps do not run in a container. `BasePackagesTest` and `CatalogTest`
exist for this.

**Read the upstream source instead of remembering it.** Three releases went
into an X11 bridge that ran `app_process` inside proot, while upstream's README
had a two-line example contradicting it. The pty carries no DTR because
`drivers/tty/pty.c` defines no `.tiocmset` — checked, not recalled.

**Existence is not readiness.** A killed X server leaves its socket file
behind; connecting to it fails while `File.exists()` returns true. The app
connects, and the guest polls `xset`. Anything that waits for a thing must wait
for the thing to *answer*.

**Measure before optimising.** `Stopwatch` writes a timed line per launch stage
into the session log. "It is slow" was answered with a guess more than once.

## Shape of the project

```
:app        Compose UI, services, the object graph, the X11 and USB bridges
:core       pure logic: model, probe, runtime, provision, store, oci — no UI
:lorie      the X server, vendored, unmodified
:usbserial  the USB serial drivers, vendored, our build file
```

`:core` has no Compose and no Activity; `:app` has no proot knowledge beyond
calling into `:core`. That split is what makes the runtime testable on a JVM,
which is where almost all of the tests run.

Catalog data — distributions, desktops, optional software — lives in
`app/src/main/assets/catalog/*.json` and never in a `when (id)` branch. Adding
a distribution is a row; if it needs code, the shape is wrong.

## Before pushing

```sh
./gradlew :core:test :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Zero lint errors is the standard, not "no new ones". Two opt-in tests need real
archives and are worth running before a release:

```sh
curl -s https://deb.debian.org/debian/dists/trixie/main/binary-arm64/Packages.gz -o /tmp/P.gz
NAWAH_TEST_PACKAGES=/tmp/P.gz ./gradlew :core:test
```

## What cannot be tested here

The Binder handshake, actual rendering, audio and USB all need a device. The
session log is written to be the substitute: every stage is timed, every
failure names itself, and `docs/x11-bridge.md` has a table mapping each line to
its cause.
