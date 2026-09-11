# Native binary pipeline

Three scripts, run in this order when the pin moves:

```sh
python3 lock.py     # resolve versions + hashes against the live Termux index
python3 fetch.py    # download, verify, extract, rename, patch ELF, verify again
python3 verify.py   # the CI check: hashes and DT_NEEDED resolution
```

`native.lock.json` is the pin. `fetch.py` refuses to proceed on a SHA-256
mismatch and exits non-zero if any dependency is left unresolved, so a bad
binary cannot reach an APK quietly.

The produced files under `app/src/main/jniLibs/` are **committed**: the build is
then reproducible and CI needs no network for them.

Why the binaries are named `lib*.so` at all, and what the ELF patching is for,
is in [`../../docs/native-binaries.md`](../../docs/native-binaries.md).
