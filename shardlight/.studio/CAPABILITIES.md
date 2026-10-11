# Host capability report — 2026-10-11

Observed, not assumed.

| Capability | Status | Notes |
|---|---|---|
| Delegation | Native team | `Agent` tool, model override `sonnet` (Sonnet 5.5) for secondary asset/content work as user requested. Coordinator = this session. |
| Concurrency | 4 vCPU, 15 GB RAM, no swap, ~27 GB free disk | Cap concurrent Blender/Godot-heavy workers at 3–4. |
| GPU | **None** | Rendering verified via Mesa lavapipe (Vulkan 1.4, llvmpipe). Godot Forward+ ≈ 6 FPS at 1280×720 — good for screenshots, **not** for performance claims. |
| Blender | 4.5.3 LTS, downloaded to /opt/tools | Headless: Workbench, Eevee Next (slow, ~40 s/frame small), Cycles CPU all render. |
| Godot | 4.7.2-stable official, /opt/tools | Export templates 4.7.2 installed (Windows x86_64, Android, Linux). Jolt physics built-in. |
| Android toolchain | SDK cmdline-tools, build-tools 35.0.0, platform 35, platform-tools; OpenJDK 21 | APK export (non-Gradle) feasible. No device/emulator → APK **cannot be run-tested here**. |
| Windows | Export via templates from Linux | **No Windows machine** → .exe cannot be run-tested here. |
| Audio | numpy 2.5, scipy, soundfile installed | Synthesized SFX/music possible. **No audio output device**; I cannot listen — audio judged only by waveform/spectral analysis. |
| Image inspection | Read tool shows PNGs | Visual review of screenshots/renders by the model — real but not a human playtest. |
| Network | Proxy; GitHub releases, blender.org, Google SDK, pypi/npm, kenney.nl, polyhaven API reachable | No paid services used. |
| Persistence | Session-bound; git branch `claude/open-world-3d-game-3it7xp` pushed to origin | `send_later` exists, but no unattended multi-day runner. Deliver RESUME_PROMPT. |
| Budget | Unknown monetary cap; token budget large but finite | No paid APIs. Treat as session-bound. |

## Things that cannot be verified in this environment
- Real frame rate on Android/Windows hardware.
- How the game *feels* to play with a human hand on input; audio by ear.
- Touch input on a real device.
