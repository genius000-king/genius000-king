# On-device test pass

The build machine has no emulator, so the graphical path cannot be proven
anywhere but a real phone. This is that pass. Run it in order; each step
assumes the previous one passed.

For anything that fails, capture what the **Capture** column says and attach it
to the report. `adb logcat` tags used by the app: `NawahSession`,
`Nawah X11 loader`.

| # | Do this | Expect | Capture if it fails |
|---|---|---|---|
| 1 | Install the APK | Installs; one icon named **Nawah** appears. **Not two** — a second icon means the manifest merge regressed | `adb install` output |
| 2 | Open the app | Empty home screen, one **Create a system** button | logcat, whole app |
| 3 | Menu → Diagnostics | Shows your real ABI, RAM, free space, API level | screenshot |
| 4 | Diagnostics → **Run the check** | "The container starts on this device". This is proot actually executing — if it fails here, nothing else can work | the failure detail text shown under it |
| 5 | Create a system → step 1 | Debian entries each show a compatibility badge; tapping one reveals the signals | screenshot |
| 6 | Steps 2–4, then **Install** | Wizard advances; Install is only enabled once a name is valid | screenshot |
| 7 | Watch the install | Steps tick over in order; the log pane scrolls real `apt` output; the notification shows progress | the log pane text |
| 8 | Leave the app during install | Install continues; notification stays | logcat |
| 9 | Install finishes | Machine appears on home as **Ready** | `install.log` via Export diagnostics |
| 10 | Press **Run** | The desktop activity opens and XFCE appears within ~20 s | logcat `Nawah X11 loader` **and** `NawahSession` |
| 11 | Touch, drag, tap | Pointer follows; a tap clicks | video if possible |
| 12 | Open a terminal in XFCE, run `uname -a` | Reports Linux, aarch64 | screenshot |
| 13 | Run `free -h` and `df -h` inside | Plausible numbers, no errors | screenshot |
| 14 | If audio was enabled: play any sound | Comes out of the phone speaker | `pactl info` output |
| 15 | If storage was enabled: `ls /sdcard` | Your phone's files | terminal output |
| 16 | Home button, then reopen from the notification | Desktop still there, session alive | logcat |
| 17 | Notification → **Stop** | Session ends; machine returns to Ready | logcat |
| 18 | Reboot the phone, open the app | The machine is still listed and still Ready | screenshot |
| 19 | Run it again | Desktop comes back without reinstalling | logcat |
| 20 | Settings → **Repair X11 bridge** | Completes without error; the desktop still starts afterwards | logcat |
| 21 | Settings → Delete, confirm | Machine disappears; free space goes back up | screenshot |

## The two failures worth recognising on sight

**"app_process is not visible inside this container"** — the bind list lost
`/system`, `/apex` or `/linkerconfig`. See `docs/x11-bridge.md`.

**"Signature check failed"** — the app was rebuilt with a different signing key
after this machine was installed. Settings → Repair X11 bridge fixes it. This
is expected when moving between a locally built APK and a release one.
