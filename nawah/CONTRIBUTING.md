# Contributing

## Ground rules that are not style preferences

**Never edit `vendor/`.** The termux-x11 submodule is pristine, and it can stay
that way because upstream parameterised the embedding. If you think you need to
change it, you almost certainly need to change how we *configure* it instead.

**Do not remove a bind from `ProotArgsBuilder` for tidiness.** Every entry is
there for a reason the call site cannot show you, and the `/system`, `/apex`
and `/linkerconfig` binds are what make the desktop possible at all. The tests
in `ProotArgsBuilderTest` exist to make that removal fail loudly.

**Do not set `jniLibs.useLegacyPackaging = false`.** It silently removes the
app's ability to execute anything. `docs/native-binaries.md` explains why.

**Do not commit a native binary by hand.** Run `tools/native/fetch.py`, which
verifies hashes, resolves dependencies transitively and re-checks its own work.
`verify.py` runs in CI and will catch anything else.

## Adding a distribution or desktop

Data only — see `docs/adding-a-distro.md`. If a change requires branching on a
distro id somewhere in the code, the design is wrong.

## Tests

`:core` is where the logic lives and where tests are expected. Anything that
can be a pure function over `FileSystemFacts` or a fake `ProotRunner` should
be, because that is the only way to test it without a phone.

A green build does not mean the desktop works. Real changes to the runtime or
the bridge need a pass through `docs/device-testing-checklist.md` on actual
hardware, and the pull request should say which device.

## Honesty in the UI

The app tells users plainly that it cannot limit memory and cannot enforce a
disk quota, because neither is possible without root. Do not add a control that
implies otherwise, even if a competing app has one.
