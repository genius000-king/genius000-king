# Circuit Lab

A browser-based 3D electronics workspace for Espressif **ESP32-DevKitC V4 / ESP32-WROOM-32E-N4**. All fifteen component types are independent 3D assemblies. Drag and rotate parts, edit all three position/rotation axes, create arbitrary terminal connections, route wires with up to eight movable bends, and inspect electrical results. Incorrect wiring is allowed and diagnosed.

## Run locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No compilation service, secret, account, or external simulator is required. The source compiler, independent firmware VMs, electrical solver and project storage run in the browser. Google Fonts is optional; local system fonts are the fallback.

```sh
npm test        # electrical, compiler, VM and persistence tests
npm run build  # production bundle in dist/
```

Browser workflow verification uses the installed Chromium through Playwright:

```sh
node tests/browser-workflows.mjs
```

The script expects a running Vite server at `http://127.0.0.1:5173`, Chromium at `/usr/bin/chromium`, and writes actual screenshots to `/workspace/artifacts/circuit-lab`. `tests/inspect-browser.mjs` is a shorter visual smoke check. Browser QA was performed with WebGL2 software rendering. Native hardware WebGPU is selected when available but is not certified by that run.

## Architecture

- `src/data.js`: authoritative board identity, source references, physical terminal map, component definitions, versioned project validation/migration and example source files. Millimeters are canonical; `MM` is the renderer conversion.
- `src/scene.js`: procedural Three.js component assemblies, materials, pins, raycasting, orbit and transform controls, and live wire routing. WebGPU initialization falls back to WebGL2. Idle frames skip drawing. Electrical connectivity never comes from visual proximity.
- `src/world.js` and `src/network.js`: independent firmware per board, shared clock/circuit, virtual AP/station association and UDP queues.
- `src/routing.js`: bounding-box clearance, crossing-height separation and deterministic routing.
- `src/engine.js`: union-find electrical nets and nodal conductance analysis with piecewise-linear LED iteration; structured GPIO, ADC, averaged PWM, interrupt/timer and logical peripheral models.
- `src/compiler.js`: tokenizer → recursive-descent parser → bytecode compiler → bounded stack VM. Source is not executed with `eval` or interpreted by regular-expression matching.
- `src/sim.worker.js`: independent 1 ms simulation clock, bounded catch-up, commands and 20 Hz state snapshots. Slow machines run simulated time more slowly instead of increasing the solver timestep.
- `src/Editor.jsx`: CodeMirror C++ highlighting, line numbers, indentation, search/replace, history and source diagnostics.
- `src/App.jsx`: unified project state, contextual inspector, floating/split editor, diagnostics, manual save, autosave, JSON import/export, undo/redo and keyboard commands.

## Supported firmware environment

This is an **explicit Arduino-style language subset targeting the Lab bytecode VM**. It is not an ESP32 instruction-set emulator and does not run Xtensa binaries or arbitrary Arduino libraries. Upload means transferring compiled bytecode to the virtual device, not flashing physical hardware.

Supported syntax: numeric/string values, variables, typed function declarations and parameters, function calls, `if`/`else`, `while`, `for`, `return`, `break`, arithmetic/bitwise/logical/conditional expressions, assignment and increments. Integer values use JavaScript numeric semantics, not exact C/C++ overflow, casts or integer division. There are no arrays, pointers, classes, structs, templates, macros or external libraries. Unsupported syntax and APIs fail with diagnostics.

Supported APIs include:

- `pinMode`, `digitalWrite`, `digitalRead`
- `analogRead`, `analogReadMilliVolts`, `analogReadResolution`, `analogSetAttenuation`
- `ledcAttach`, `ledcWrite`, `ledcSetup`, `ledcAttachPin`, `analogWrite`, `tone`, `noTone`
- `delay`, `delayMicroseconds`, `millis`, `micros`
- `Serial.begin`, `Serial.print`, `Serial.println`, `Serial.available`, `Serial.read`
- `Wire.begin`, `Wire.beginTransmission`, `Wire.write`, `Wire.endTransmission`
- Lab display extensions: `LCD.begin`, `LCD.clear`, `LCD.setCursor`, `LCD.print`, `LCD.println`, `LCD.display`; `OLED.begin`, `OLED.clear`, `OLED.setCursor`, `OLED.print`, `OLED.println`, `OLED.display`
- `attachInterrupt`, `detachInterrupt`, `digitalPinToInterrupt`
- Lab timer extension: `timerEvery(milliseconds, callback)`, `timerCancel(id)`
- `SPI.begin`, `SPI.transfer`: logical edge model, sampling the actually connected MISO net
- `min`, `max`, `abs`, `sin`, `cos`, `sqrt`, `pow`, `map`, `constrain`, seeded `random`

`Wire.requestFrom` explicitly warns that register reads are unsupported by the text OLED. I2C ACK requires matching address, power, common ground, separate connected SDA/SCL nets and released bus lines. Raw SSD1306 commands are logged but are not a complete display-controller implementation. OLED text frames use the documented Lab extension. UART is a logical RX queue and output log; no UART line timing is claimed. SPI has no external slave model and no sub-millisecond timing fidelity. Interrupts and timers execute at 1 ms resolution. `delayMicroseconds` is accepted but quantized by that resolution. Full wireless protocol stacks, FreeRTOS, DMA, USB protocol, flash filesystems and cycle-exact ESP32 peripheral behavior are unsupported.

GPIO34/35/36/39 are input-only without internal pulls. GPIO6–11 are rejected as flash-reserved. EN holds the CPU in reset; BOOT pulls GPIO0 low; GPIO0/2 and GPIO12 strapping affect reset boot state. The onboard red LED is power indication, not a GPIO2 user LED. The initial blink uses a separate wired LED.

Every ESP32 has independent source files, bytecode execution, GPIO, timers, UART, I2C and ADC state. Select the target in the editor; Run compiles all board programs before starting them on a shared clock. Newly added boards start with an empty sketch until programmed. Wired GPIO interconnection is solved electrically.

The **Two boards · Wi-Fi** example creates a virtual AP and station. Supported network APIs are `WiFi.softAP`, `WiFi.begin`, `WiFi.status`, `WiFi.localIP`, `WiFi.softAPIP`, `WiFi.disconnect`, `WiFi.softAPdisconnect`; `UDP.begin`, `UDP.beginPacket`, `UDP.print`, `UDP.write`, `UDP.endPacket`, `UDP.parsePacket`, `UDP.readString`, `UDP.remoteIP`, `UDP.remotePort`, `UDP.stop`. `WL_CONNECTED` equals 3. The built-in `UDP` object is a Lab extension, not an instantiated WiFiUDP C++ library.

Association requires an active AP and matching SSID, password and optional channel. It takes 100 simulated ms; datagrams take 2 ms. AP address is 192.168.4.1; station addresses are assigned deterministically. Broadcast is 192.168.4.255. Receive ports and network membership must match. Missing peers, wrong credentials, stopped boards, full queues and packet drops are observable. Payloads are bounded to 256 characters, receive queues to 64 messages, pending delivery to 256 packets. This is a **logical network**, not RF propagation, 802.11 frames, real WPA encryption, TCP, DNS, HTTP/internet access, realistic congestion or a full ESP-IDF stack. No packets leave the browser.

## Electrical model and limits

The solver computes voltages and currents from the connection graph. Resistors obey Ohm's law. LEDs use configurable forward voltage plus 15 Ω dynamic resistance. Potentiometers stamp two resistances. Buttons close contacts with deterministic configurable bounce. Breadboard columns connect A–E and F–J independently; the center gap and adjacent columns remain isolated.

Additional models: LDR uses R10 × (10/lux)^gamma; NTC uses the Beta equation relative to 25 °C; SPDT stamps a 0.1 Ω selected contact; seven-segment common-cathode displays stamp eight independent LEDs; batteries use a 0–24 V source and configurable internal resistance/current rating. LCD is a generic 3.3 V 16×2 I2C text module, not a full HD44780 or PCF8574 emulator. Generic models and component dimensions are approximations. Real 5 V LCD backpacks may need level shifting.

The board is virtually USB powered. Supplies and outputs use finite source resistances. Modeled source/output resistances and a 500 mA supply alert threshold are simulation assumptions, not official guaranteed device specifications. Supply overloads and shorts produce diagnostics; regulator foldback, thermal damage and permanent component failure are not modeled. High impedance uses numerical leakage to stabilize floating nets. ADC conversion is ideal 9–12 bit with configurable full scale; real ESP32 calibration, noise and radio contention are not modeled. PWM is an averaged electrical source, not a transient switching circuit. The scope shows solved voltage at 10 ms samples. The microphone is a user-configurable synthetic sine-wave voltage source, not device microphone capture. Passive buzzer audio requires a connected PWM source; active buzzers respond to supply. Audio is opt-in through a browser gesture.

No capacitive/inductive transients, parasitic components, EMI/RF, transistor internals or analog power electronics are claimed. Unsupported physics must not be mistaken for SPICE or a safety assessment of real hardware.

## Geometry provenance

See [docs/HARDWARE_REFERENCE.md](docs/HARDWARE_REFERENCE.md). Board outline, header counts/pitch/spacing, exact header order and module envelope are sourced from official Espressif references. Fine geometry (carrier thickness/radius, switch and USB details, inferred SMD placement, pin profile and antenna artwork) is explicitly tagged approximate. No undocumented manufacturing tolerances are presented as specifications.

## Persistence and controls

A version 2 JSON project stores components, transformations, electrical parameters, wire endpoints and bends, all source files, selected board revision, independent firmware for each board, appearance, editor mode and camera. Version 1 imports migrate explicitly. Local autosave is debounced; storage failures prompt export. Invalid imports leave the working project intact. A running CPU state is not restored after reload; saved source and circuit restart from reset.

- Appearance in Workspace options controls light/dark themes and glass opacity across panels and buttons.
- Click a pin to inspect its label, functions and solved voltage; Trace net highlights actual electrical connections.
- Camera controls open a compact orbit/zoom/focus palette; touch gestures are supported by OrbitControls.
- Automatic wire routing clears conservative component bounding boxes and separates planar crossings by height. It is a routing aid, not mechanical cable simulation; manually edited paths can intersect objects and are intentionally allowed.
- Drag: place on the work surface, preserving the grab offset.
- Three-axis move handle: translate including lift/lower; Y is clamped at the work surface.
- Rotate handle: free rotation; Shift enables 15° snapping.
- Inspector: exact position/rotation, 90° rotation and 180° flip.
- Shift-click: multi-select; duplicate/delete/align in the inspector.
- W: wire tool; click any two actual terminals, or use the named-terminal dialog. Invalid electrical combinations are allowed.
- Selected wire: edit color, reconnect endpoints, add bends. Drag a bend along the work plane; Shift-drag lifts/lowers it.
- Empty-space drag: camera orbit; right-drag: pan; scroll: zoom; F: focus.
- Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z: object/connection undo/redo.
- Cmd/Ctrl+D: duplicate; Delete: remove; Space: run/pause; Cmd/Ctrl+S: save.
- CodeMirror: normal editing, copy/paste, undo and Cmd/Ctrl+F search/replace.

## Security and resource bounds

The VM does not use JavaScript evaluation or network calls. Execution, call stack, VM stack, pending interrupts, solver iterations and worker catch-up are bounded. Imports validate version, transforms, terminal existence and route data, with limits of 200 components and 2,000 wires, with a 700-active-net solver budget. Unsupported firmware and solver failures stop execution with visible diagnostics.
