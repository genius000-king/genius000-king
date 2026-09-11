# Changelog

## [Unreleased]

### Added
- Debian 12 and 13 installation via proot, with the system image pulled from
  the OCI registry and its digest verified while streaming.
- XFCE 4 desktop rendered through the embedded `lorie` X server — one APK, no
  Termux and no Termux:X11.
- A four-step setup wizard: distribution, desktop, resources, permissions.
- A live compatibility check that runs the bundled proot on the device rather
  than guessing from RAM and CPU numbers.
- Multiple named systems, each with its own permissions, resolution and
  storage figure.
- Audio out and microphone over PulseAudio, and `/sdcard` via a bind mount,
  both gated per machine.
- "Repair X11 bridge" for systems installed by a differently-signed build.
- Diagnostics screen with an exportable support bundle.
