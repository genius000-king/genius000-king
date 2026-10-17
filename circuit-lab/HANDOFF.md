# Circuit Lab handoff

Latest user priority: deliver the current application immediately as one standalone HTML, plus full source and a short continuation prompt. Stop expanding scope until that delivery. The user prefers charcoal/black/grayscale UI, high glass transparency everywhere, minimal visible controls, realistic 3D components, arbitrary wiring, precise manipulation and independent multiple ESP32 boards.

## Current implementation

- React + Three.js procedural 3D, native WebGPU attempted with WebGL2 fallback; physically separate meshes merged for efficiency. Official DevKitC V4 / WROOM-32E-N4 reference dimensions and explicitly approximate fine geometry.
- 15 component types: ESP32, LED, resistor, button, pot, microphone, buzzer, OLED, breadboard, LCD, LDR, NTC, SPDT, seven-segment, battery.
- Real explicit net graph / nodal DC solver, GPIO/ADC/PWM models, per-component electrical behavior and diagnostics. Auto wire paths clear bounding boxes and separate crossing heights; manual bends remain allowed.
- Lexer/parser/compiler -> bounded bytecode VM for a documented Arduino-like subset. CodeMirror editing. Not arbitrary C++ or Xtensa binaries.
- Separate source/VM/GPIO per ESP32, shared deterministic 1 ms clock. Virtual AP/station association with SSID/password/channel matching, UDP delivery, independent programs and network log. Not RF, 802.11, real cryptography, TCP, DNS, internet, or full ESP-IDF.
- Floating/split editor, global opacity, charcoal default theme, pin-click inspector and actual net tracing, camera controls, undo/redo, JSON export/import and local autosave.

## Build and verification

`npm ci`, `npm run dev`, `npm test`, `npm run build`.
Standalone: `npx vite build --config vite.standalone.config.js`. Worker is imported with `?worker&inline` so no external worker asset is required. Dynamic imports are bundled into the standalone HTML. Browser font requests are optional; system fonts are the fallback.
45 engine/compiler/network/routing/persistence tests passed. Browser workflows 1–9 passed in an initial phase after fixing stale transform axes. `tests/browser-tail.mjs` then passed button, ADC, OLED, incorrect wiring, compiler diagnostics, persistence and mobile checks with zero browser errors. `tests/additional-workflows.mjs` passed theme/opacity, pin picking, LCD, independent board programs, UDP, wrong-password failure, export/reload and added models, zero browser errors. Chromium software WebGL2 was tested; real hardware WebGPU was not verified.

## Known limits and next work

- Preserve honest scope: dense 700-active-net budget, up to 200 parts / 2,000 wires, average-voltage PWM, ideal ADC, synthetic microphone, logical UART/SPI/display/network APIs. It is not SPICE or a complete ESP32/Wi-Fi emulator.
- Generic component dimensions and small board geometry are approximated. Improve models using verifiable references rather than claiming photoreal manufacturing fidelity.
- The present OLED.setCursor stores a cursor but text writing currently appends; implement correct cursor-aware text behavior and add tests, or explicitly diagnose unsupported cursor positioning.
- CodeMirror propagates programmatic document replacement to its onChange callback. Suppress that callback during external synchronization so switching board source does not mark a valid build dirty.
- The resistor body bands currently depict the default 220 ohms and should update with the configured resistance.
- More detailed/performance-tested large projects, import validation, I2C address collision diagnostics, mechanical wire collision review, real peripherals and broader firmware execution remain future work.
- Screenshots 23–33 show the latest neutral charcoal theme. Screenshots 1–22 include earlier light/green interface states and should be recaptured before presenting a final gallery as all-current.
- Sites publication was prepared earlier but no production version was published. The immediate user request superseded publishing with urgent file delivery. Do not claim that a live site exists.

The standalone HTML is a deliverable snapshot; continue development from these source files, not by editing the generated minified HTML.
