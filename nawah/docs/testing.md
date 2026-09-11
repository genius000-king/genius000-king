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
