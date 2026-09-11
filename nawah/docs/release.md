# Releasing

## Signing

The debug keystore at `signing/nawah-debug.jks` is **committed on purpose**.
The guest-side loader verifies the app's signing certificate, so a per-machine
debug key would break the X11 bridge on every clean checkout (see
`docs/x11-bridge.md`). It is a debug key and protects nothing; do not ship with
it.

For a real release:

```sh
keytool -genkeypair -v \
  -keystore signing/release.jks \
  -alias nawah -keyalg RSA -keysize 4096 -validity 10000
```

Then `signing/release.properties` (git-ignored):

```properties
storeFile=signing/release.jks
storePassword=…
keyAlias=nawah
keyPassword=…
```

`app/build.gradle.kts` picks this up automatically and falls back to the debug
key when it is absent, so a release build always succeeds locally.

**Changing the release key invalidates the X11 bridge inside every already
installed machine.** Users of an older build will need Settings → Repair X11
bridge. Plan key rotation accordingly; there is no way around it, because the
check is what stops a replaced APK from being loaded.

## CI

Four repository secrets drive `.github/workflows/release.yml`:

| Secret | Value |
|---|---|
| `KEYSTORE_B64` | `base64 -w0 signing/release.jks` |
| `KEYSTORE_PASSWORD` | store password |
| `KEY_ALIAS` | `nawah` |
| `KEY_PASSWORD` | key password |

Push a `v*` tag. The workflow builds the APK and the AAB, publishes both with a
`SHA256SUMS` file, and deletes the decoded key material afterwards.

## About Google Play

The `.aab` is produced because it costs nothing to produce, not because a Play
listing is expected to survive review. An app that downloads and executes code
is squarely inside the Device and Network Abuse policy, and Termux — which does
the same thing — was removed. Expect rejection, and treat GitHub Releases and
F-Droid as the real distribution channels.

If you submit anyway: the foreground service types are declared with
justifications, the app requests no dangerous permission it does not use, and
`RECORD_AUDIO` is only requested when a user enables the microphone for a
machine. Those are the questions review asks first.
