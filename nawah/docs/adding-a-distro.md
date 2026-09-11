# Adding a distribution or a desktop

Both are data. Adding Ubuntu or KDE means editing a JSON file, not writing a
class — and if you find yourself needing an `if (distroId == …)` somewhere,
that is a design bug, not a missing feature.

## A distribution

Add an entry to `app/src/main/assets/catalog/distros.json`:

```json
{
  "id": "ubuntu-noble",
  "name": "Ubuntu 24.04",
  "codename": "noble",
  "image": "library/ubuntu:noble",
  "downloadBytes": 29000000,
  "installedBytes": 78000000,
  "aptMirror": "http://ports.ubuntu.com/ubuntu-ports",
  "enabled": true
}
```

- `image` is an OCI reference pulled from Docker Hub. It must publish a
  `linux/arm64` manifest; the client selects the right one and refuses to
  substitute another architecture.
- `downloadBytes` and `installedBytes` drive the storage estimate and the
  compatibility badge. Get real numbers rather than guessing — the registry
  reports the compressed layer size in its manifest.
- `aptMirror` differs for Ubuntu on ARM (`ports.ubuntu.com`), which is exactly
  the kind of detail a hardcoded branch would have buried.

A non-Debian distribution (Arch, Alpine) needs its package manager handled in
`ProotProvisioner`, which currently speaks `apt` only. That is a real change,
not a data one.

## A desktop

Add an entry to `app/src/main/assets/catalog/desktops.json`:

```json
{
  "id": "lxqt",
  "name": "LXQt",
  "packages": ["lxqt-core", "qterminal"],
  "startCommand": "startlxqt",
  "installedBytes": 620000000,
  "enabled": true
}
```

`startCommand` is run under `dbus-launch --exit-with-session` once X is up. The
base packages every desktop needs (`dbus-x11`, `xkeyboard-config`, …) are in
`ProotProvisioner.BASE_PACKAGES` and are added automatically.

## Turning one off

Set `"enabled": false`. It disappears from the wizard without breaking machines
already installed from it — the catalog is only consulted for display names
after install.
