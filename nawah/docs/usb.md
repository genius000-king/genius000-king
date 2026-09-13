# USB

A phone with an OTG cable is a computer with a serial port. This is how that
port reaches the Linux side.

## Why the app has to be in the middle

Android does not let an app read `/dev/bus/usb`, and it does not let a *program
inside the container* anywhere near it either. The only door is
`UsbManager.openDevice`, which returns an already-open file descriptor after the
user has agreed, to the app that asked.

That descriptor cannot be handed on as a path. Binding `/proc/self/fd/N` into
the container does not help: opening a procfs fd link re-opens the underlying
file and re-checks permission, so the container gets `EACCES` exactly as it
would from the real node. A program in the guest can only use such a descriptor
if it was written to accept one — `libusb_wrap_sys_device()` — which stock
`avrdude`, `esptool` and `arduino-cli` were not.

So the app holds the device and presents it to Linux as something Linux already
understands.

## The shape of it

```
 container                        app                          hardware
 ─────────                        ───                          ────────
 /dev/ttyUSB0  ◄── proot bind ── /dev/pts/N  (pty slave)
 a real tty                       │
                                  │ SerialPty holds the master
                                  │    │
                                  │    ├── bytes ───────────►  UsbSerialPort
                                  │    └── termios ─────────►  setParameters()
                                  │
 nawah-usb  ─── tcp 127.0.0.1 ───►│  control: dtr, rts, reset
```

The bind is a rename, not a mount: `/dev/pts/N` is a real node in Android's
`/dev`, which proot already binds, so `--bind=/dev/pts/N:/dev/ttyUSB0` costs
nothing and the container sees an ordinary serial port.

## Why a pty and not a socket

Because of one line: `tcgetattr` on the master returns the **slave's** termios.
When something inside the container runs `screen /dev/ttyUSB0 115200`, or
`stty -F /dev/ttyUSB0 9600`, or `arduino-cli monitor`, that speed is readable
from outside and applied to the real device. Nothing in this app configures a
baud rate; the container decides and the app follows.

A socket plus `socat` would have needed an extra package, an extra hop, and a
command to tell the app what speed to use.

## What it cannot do, and why that is not fixable here

`drivers/tty/pty.c` defines no `.tiocmget` and no `.tiocmset` for Unix98 ptys.
So `TIOCMSET` on `/dev/ttyUSB0` returns `-ENOTTY`, and every tool that toggles
DTR or RTS to reset a board gets an error rather than a reset. That is the
kernel, not this code.

The way round it is out of band:

```sh
nawah-usb reset          # pulse DTR — resets an Arduino
nawah-usb reset-esp      # BOOT + reset — ESP32 download mode
nawah-usb dtr on|off
nawah-usb rts on|off
nawah-usb status
```

`nawah-usb` is bash over `/dev/tcp`, so a machine needs no extra package to use
it. Then run the flashing tool with its own no-reset option
(`esptool --before no_reset --after no_reset`, and for `avrdude` a programmer
that does not drive DTR).

**The proper fix, not done yet:** a small `LD_PRELOAD` shim in the guest that
intercepts `ioctl(TIOCMSET)` on this fd and forwards it over the same control
socket. It needs a glibc-targeted aarch64 build, which the NDK (bionic) does not
produce, so it is a real piece of work rather than an afternoon.

## Beyond serial

Everything above is the serial case, which covers Arduino, ESP32, USB-TTL
adapters, GPS modules, LoRa boards and modems. Raw USB — a logic analyser, an
ST-Link, a USBasp — needs the guest program to accept a passed descriptor via
`libusb_wrap_sys_device()`. A shim that does that for unmodified binaries is the
same piece of work as the `ioctl` shim above, and would solve both.

## Files

| File | Role |
|---|---|
| `app/src/main/cpp/nawah_pty.c` | the four libc calls the JDK does not expose |
| `app/.../usb/SerialPty.kt` | the master, and the termios the container set |
| `app/.../usb/UsbSerialBridge.kt` | the pumps, the baud follower, the control channel |
| `app/.../usb/UsbDevices.kt` | enumeration and the Android permission |
| `core/.../provision/GuestScripts.kt` | `nawah-usb`, written on every launch |
| `vendor/usb-serial` | the drivers (MIT), never edited |
