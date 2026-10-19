# Circuit Lab handoff

User priorities (unchanged): charcoal black/gray UI, highly transparent glass, minimal visible controls. 3D models must use real, sourced proportions, colors and markings. Electronics and interactions must behave like the real thing. Send real in-app screenshots while working, with no separate display or gallery site. Be honest about limits. The code must stay split into independent engines with small named functions, and the site must load in stages and run on weak devices.

## State

- Next.js 16 App Router, static export (`out/`), no server code. Engines in `engines/` (catalog, circuit, firmware, runtime, render, workspace, projects, instruments, performance), UI in `ui/` (workbench shell + 15 hooks + one component per panel). README "Architecture" has the map and how to add a part.
- 7 boards, 83 parts + 3 breadboards, 59 projects (every one executed by `tests/projects.test.js`).
- Developer tools: firmware debugger (breakpoints, step into/over/out, locals/globals/call stack; the bench halts), Serial Plotter, RAM report after compile, VCD/CSV export.
- Inductive parts: inductor, toroid, choke, transformers (coupled windings), relay, KY-019 relay module, JF-0530B solenoid. LC ringing project matches theory within 2 % at the Precise setting.
- Staged loading (splash → workbench + 3D + worker in parallel → panels and model categories on first use), service worker for repeat/offline visits, performance engine (Battery saver / Automatic / Quality, adaptive resolution, render-on-change, hidden-tab throttling).
- `npm test`: 169 passing. `npm run check` adds the unbound-identifier check. Browser tests (zero page errors): app-tour, debugger-ui, dev-tools, performance-modes, offline, mobile, hand-controls, new-parts-shots and the workflow suites.

## Verify

```sh
npm ci && npm run check
npm run build && npm start &          # production build on 127.0.0.1:5173
node tests/app-tour.mjs               # screenshots/01…13
node tests/debugger-ui.mjs && node tests/dev-tools.mjs && node tests/performance-modes.mjs
node tests/load-budget.mjs            # bytes per loading stage
```

## Known limits and next work (most valuable first)

1. Solver: dense LU is O(n³); move to sparse LU before about 300 active nets. Backward Euler damps high-Q resonances slightly; a trapezoidal option for L/C would fix it (watch for trapezoidal ringing on switching edges).
2. Debugger: breakpoints are line numbers and do not move when lines are inserted above them; no conditional breakpoints or watch expressions yet.
3. RAM report counts the sketch's globals exactly but not core/library RAM on ESP32/RP2040/STM32 (said so in the tooltip). Flash is deliberately not estimated.
4. Firmware: structs, user classes, pointers to arrays.
5. Real-GPU WebGPU verification (QA so far is SwiftShader WebGL2).
6. Model pass: relay module variants (low-level trigger, 2/4 channel), MQ-2 mesh texture, servo horn variants.
