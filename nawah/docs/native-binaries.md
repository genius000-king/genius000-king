# Bundled native binaries

## Why executables are named `lib*.so`

Since Android 10 (API 29) an app may not execute a file from its own data
directory. `W^X` enforcement means the only place left from which an app can
`exec` is `nativeLibraryDir` — the directory the package manager fills from the
APK's `lib/<abi>/` entries.

Two consequences follow, and both are easy to get wrong:

1. **The packaging tools only extract files named `lib*.so`.** A file called
   `proot` or `libtalloc.so.2` is left compressed inside the APK and never
   appears on disk. So every executable we ship is renamed.
2. **`jniLibs.useLegacyPackaging` must stay `true`.** With legacy packaging
   off, native libraries are mapped straight out of the (compressed) APK and
   are *never written to disk at all*. There is then no `libproot.so` to
   execute, and the app fails with a missing-file error that points at nothing.
   The setting is in `app/build.gradle.kts` with a comment saying exactly this.

## What is bundled, and where it comes from

We do not compile proot. Termux publishes maintained, Android-targeted builds,
and `tools/native/native.lock.json` pins the exact package versions and their
SHA-256 hashes.

| Shipped as | Source | Licence |
|---|---|---|
| `libproot.so` | termux `proot` → `usr/bin/proot` | GPL-2.0 |
| `libproot-loader.so` | termux `proot` → `usr/libexec/proot/loader` | GPL-2.0 |
| `libbusybox.so` | termux `busybox` → `usr/bin/busybox` | GPL-2.0 |
| `libbusybox_1_38_0.so` | termux `busybox` → `usr/lib/libbusybox.so.1.38.0` | GPL-2.0 |
| `libtalloc.so` | termux `libtalloc` → `usr/lib/libtalloc.so.2` | LGPL-3.0 |
| `libandroid-shmem.so` | termux `libandroid-shmem` | MIT |
| `libandroid-selinux.so` | termux `libandroid-selinux` | Public domain |
| `libpcre2-8.so` | termux `pcre2` | BSD-3-Clause |

## The rename is not just a rename

`libtalloc.so.2` becomes `libtalloc.so`, but `libproot.so` has a `DT_NEEDED`
entry naming the *old* file, and the library's own `SONAME` still says
`libtalloc.so.2`. Left alone, the dynamic loader searches for a file Android
never unpacked. `tools/native/fetch.py` therefore rewrites, with `patchelf`:

- `SONAME` on each renamed library, to its new name
- every `DT_NEEDED` that referenced an old name
- the `DT_RUNPATH` Termux builds carry, which points at
  `/data/data/com.termux/files/usr/lib` — a path that does not exist on the
  user's device. At runtime the app sets `LD_LIBRARY_PATH` to its own
  `nativeLibraryDir`, and that must be what wins.

`libproot-loader.so` is deliberately **statically linked** — it has to run
before any dynamic loader exists — so it has no dynamic section and is skipped
by all of the above. proot finds it through the `PROOT_LOADER` environment
variable, set in `ProotArgsBuilder.environment()`. Shipping it as a separate
file matters: proot's usual trick of extracting its loader at runtime would
write it into the data directory, which is exactly the non-executable place we
are avoiding.

## Dependencies are resolved transitively

`fetch.py` does not take a hand-written list of libraries on faith. After
copying the mapped files it repeatedly asks the binaries themselves what they
still need (`patchelf --print-needed`), pulls in anything it finds in the
extracted packages, renames it legally, and repeats until nothing is
unanswered. Names Android itself provides (`libc.so`, `liblog.so`, …) are never
bundled.

This is how `libbusybox.so.1.38.0` and `libpcre2-8.so` got here: neither was in
the original list, and both would have shipped as a runtime failure.

## Commands

```sh
python3 tools/native/lock.py    # re-resolve versions against the live repo
python3 tools/native/fetch.py   # download, verify, rename, patch, verify again
python3 tools/native/verify.py  # CI check: hashes and DT_NEEDED resolution
```

`fetch.py` aborts on a SHA-256 mismatch and exits non-zero if any dependency is
left unresolved. The produced binaries are **committed** rather than fetched at
build time, so the APK is reproducible and CI needs no network for them.

## Adding an ABI

1. Add it to `ABIS` in `tools/native/lock.py` (`"x86_64": "x86_64"`).
2. Add it to `ndk.abiFilters` in `app/build.gradle.kts`.
3. Re-run `lock.py` then `fetch.py`.

Note that each extra ABI roughly doubles the X server's native build time,
which is the main reason the project ships arm64 only.
