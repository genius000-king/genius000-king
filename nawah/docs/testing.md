# Testing

## What CI proves, and what it does not

The build container has no `/dev/kvm`, so there is no Android emulator. That
is not a temporary gap to be worked around — it sets a hard boundary around
what any automated result here can mean.

**CI can prove:**

- the whole thing compiles, including the X server's native code for arm64
- the bundled native binaries match their lockfile hashes and every
  `DT_NEEDED` resolves (`tools/native/verify.py`)
- the pure logic is correct: the proot argv, the compatibility thresholds, the
  install state machine, the OCI manifest handling
- Android Lint finds no blocking issues

**CI cannot prove:**

- that proot actually runs on a real device (ptrace can be disabled by an OEM)
- that the Binder handshake completes
- that anything appears on screen

So a green build means "it builds and its logic is right", not "the desktop
works". Anyone who reports the second from the first is guessing. The device
checklist in `device-testing-checklist.md` is what closes that gap.

## Running the tests

```sh
./gradlew :core:test          # JVM unit tests
./gradlew :app:lintDebug      # Android Lint
python3 tools/native/verify.py
```

## The proot harness

The one piece of the pipeline that can be exercised for real off-device is the
guest scripting: the argv, the bind list, the apt sequencing, the script
contents. Those are pure functions over a `FileSystemFacts` and a fake
`ProotRunner`, which is why they are shaped that way — it is the only way to
test them without a phone.

## What the device found that CI did not

Three rounds of on-device testing produced three classes of bug that no unit
test here had a chance of catching, and each one changed how the code is
written rather than just what it does.

**1. A host path passed as a guest command.** The installer unpacked through
proot and handed it a path from the Android side. proot resolves commands
inside the rootfs. Fixed by unpacking on the Android side entirely — the bug
class disappears rather than being avoided.

**2. Exit codes ignored.** Output was streamed but never checked, so five steps
reported success over work that had not happened. `ProotRunner.exec()` now
returns the code and the installer throws on non-zero.

**3. API level claimed but not honoured.** `minSdk` said 24 while the code
called `startForegroundService` and `java.nio.file.Files` — both API 26. Lint
caught it once it was run; it had been in every build before that. `minSdk` is
now 26, which is what the code actually requires.

The third is the useful lesson: `assembleDebug` passing is not the same as
`lintDebug` passing, and a manifest attribute is a claim the compiler does not
check. Both run in CI now.

## The install has to survive being interrupted

A twenty-minute install on a phone gets interrupted: the connection drops, the
user leaves, the system reclaims the process. None of these are exceptional and
none of them should cost the work already done.

- `InstallCheckpoint` records the finished steps and the original request after
  every step, so a resume works from a cold process.
- The blob download keeps a `.part` file and continues with an HTTP `Range`
  request. `ResumableDownloadTest` hangs up a real socket mid-transfer and
  asserts the retry asks for the remainder.
- `apt` keeps its own state in dpkg, so re-running it after an interruption
  resumes rather than re-fetching.
- A failed machine offers **Resume** on the home screen. A greyed-out Run
  button with no other action is a dead end, and that is what the user hit.

## Names the compiler cannot check

Two categories of value in this project are strings the build will happily
accept and the world will reject:

- **Debian package names.** `xkeyboard-config` sat in the base list and failed
  every install with `E: Unable to locate package`. It is the *source* package
  name; the binary Debian publishes is `xkb-data`. `BasePackagesTest` now
  checks every name against a real `Packages` index, and CI fetches one.
- **Guest paths and commands.** proot resolves them inside the rootfs, so a
  host path that exists is still wrong. `ProotArgsBuilderTest` and
  `GuestScriptsTest` pin those.

Both are opt-in-free in CI and neither can be verified by reading the code.
When adding a package or a guest command, add it to a test that consults the
thing that actually decides.

## A script is a program, so run it

The session script broke every start with

```
/usr/local/bin/nawah-session: line 19: NAWAH_START: unbound variable
```

A leftover line referenced a variable nothing defined, and `set -u` made that
fatal. Meanwhile six tests asserted the script *contained* the right strings,
and all six were green. Checking that a program contains certain text is not
checking that it runs.

`GuestScriptExecutionTest` executes the generated script in a real bash against
a faked guest — a stub X socket, a stub `dbus-launch`, a stub desktop command —
and asserts behaviour: exit codes, which branch was taken, what reached the log.
It reproduced the device failure on the first run, before the fix.

Every failure path is forced deliberately, because each one is a different
answer to the same symptom:

| Forced condition | What the user must be told |
|---|---|
| socket never appears | the Android-side display server did not come up |
| desktop command absent | which package is missing, by name |
| `dbus-launch` absent | install `dbus-x11` |
| desktop exits non-zero | the session's real status |
| no start command at all | a terminal is launched, not a black screen |

The X server's own launch is not a script, so it is pinned differently:
`X11LaunchPlanTest` asserts the exact argv and environment it is started with.
Every display failure this project has shipped was a wrong entry in one of
those two lists, and each test there names the device symptom it prevents.

`GuestPrerequisitesTest` covers the other half: the two packages whose
absence the X server reports only as a black screen, and the rootfs states that
look installed and are not — fonts unpacked but never configured, which is a
directory full of fonts and no way to open one.

The rule this leaves behind: **anything generated that will later be executed —
a shell script, an argv, a config file — is tested by executing it, not by
reading it.** `ProotArgsBuilderTest` gets away with string assertions only
because proot itself is what consumes the argv and cannot run here; everything
that bash consumes, bash now checks.
