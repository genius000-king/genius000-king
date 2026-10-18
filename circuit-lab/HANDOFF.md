# Circuit Lab handoff

User priorities (unchanged): charcoal black/gray UI, highly transparent glass, minimal visible controls. 3D models must use real, sourced proportions, colors and markings. Electronics and interactions must behave like the real thing. Send real in-app screenshots while working, with no separate display or gallery site. Be honest about limits.

## State

- 7 boards with per-board profiles, 84 parts, 56 projects (all executed and physically checked by `tests/projects.test.js`).
- Transient MNA engine with nonlinear semiconductors, companion models for C/L, switching PWM, behavioural ICs, bus/UART/Wi-Fi models. See README "Simulation model" for the exact limits.
- Typed compiler/VM with library classes. API availability depends on the board.
- Breadboard seating (`src/snap.js`) creates explicit `kind:'contact'` connections. Hole-to-hole wires are flat solid-core jumpers bent at right angles, with a small per-wire lift so crossings don't share a surface. Other wires are Dupont jumpers with housings. Instrument leads lie on the bench and drape over obstacles (`benchBoxes`/`layoutKey` in `scene.js`). The render loop resizes itself whenever the canvas and its container disagree (the ResizeObserver alone missed drawer openings).
- UI: library with live thumbnails, schema inspector, project gallery, scope/logic drawer, calculators, BOM/SPICE/JSON export, file import (projects and `.ino` sources), and an in-app reference that matches the README.
- Hand controls in 3D: pot/encoder shafts turn by dragging, the joystick tilts and springs back, the meter dial and tilt switch click (`tests/hand-controls.mjs`).
- Full screen button (real Fullscreen API, immersive CSS fallback for iPhone). Phones: aspect-aware `fit()` (projects the box corners and binary-searches the distance), `phoneView()` turns long circuits to run up a portrait screen, bottom-sheet inspector, thumb-sized controls, double-tap to frame, and `touchend` preventDefault on the canvas so taps cannot ghost-click a panel that opens under the finger (`tests/mobile.mjs`).
- `npm test`: 153 passing (`tests/newparts.test.js` covers the transformer, rectifiers, fuse, LM317, buck, solar, gates, CD4017, L293D, ULN2003 + stepper, LM393, PC817 and the rest). Browser: `tests/app-tour.mjs` (13 shots, zero page errors). The legacy workflows were ported to the project gallery and portable paths.

## Verify

```sh
npm ci && npm test
npm run dev &
node tests/app-tour.mjs            # screenshots/01…13
node tests/showcase.mjs screenshots/x.png uno,nano,pico 3 90
npx vite build --config vite.standalone.config.js && cp standalone/index.html Circuit-Lab.html
```

## Next work (most valuable first)

1. Model pass still worth doing: relay *module* variant (blue PCB, transistor, flyback diode, screw terminal), 18650 holder vs LiPo pouch choice, MQ-2 mesh texture, servo horn variants.
2. Large-circuit performance: the dense LU is O(n³). Switch to sparse LU or a KLU-style ordering before exceeding about 300 active nets.
3. Firmware: structs, user classes, pointers to arrays.
4. Real-GPU WebGPU verification (QA so far is SwiftShader WebGL2).

Continue development from the sources. `Circuit-Lab.html` is a generated, minified snapshot.
