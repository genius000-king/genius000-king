# Changelog

## 0.6.0

- **A real USB serial port inside Linux.** A board on an OTG cable appears as
  `/dev/ttyUSB0`, a genuine terminal device, so `screen`, `minicom`, `pyserial`,
  `arduino-cli` and `stty` work unmodified. The baud rate is read back from the
  container rather than configured in the app. `nawah-usb` handles the reset
  that a pseudo-terminal cannot carry.
- **Optional software.** A desktop installed with `--no-install-recommends` has
  no browser; now one can be chosen at install, or added to an existing system
  from its settings. Package lists are per-distribution, because on Ubuntu
  `firefox` and `chromium-browser` pull a snap, which cannot run in a container.
- **Seven desktops** — XFCE, LXQt, MATE, i3, Openbox, KDE and GNOME — each
  carrying an honest note about what it costs with no GPU.
- The display size is a percentage of the screen, never a pixel size. Fixed
  sizes were pinning a 16:9 desktop onto a 19.5:9 phone.
- Every launch stage is timed into the session log.
- A missing audio package no longer stops a desktop from opening.
- The desktop's root cursor is an arrow, and compositing is off by default on
  the lighter profiles — written as configuration, not asked for at run time.

## 0.1.0 — 0.5.0

The first working app, and the rounds it took to get there.

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
