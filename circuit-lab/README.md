# Circuit Lab

A browser-based 3D electronics bench. Place real-proportioned boards and parts, seat them on breadboards, wire them, write Arduino-style firmware, and watch a transient circuit solver drive every LED, motor, display and instrument. Everything (compiler, VMs, solver, network, renderer) runs locally in the browser; there is no server, account or external simulator.

## Run

```sh
npm ci
npm run dev                                         # http://127.0.0.1:5173
npm test                                            # 114 engine / compiler / physics / project tests
npm run build                                       # dist/
npx vite build --config vite.standalone.config.js   # standalone/index.html, single file, works offline
```

`Circuit-Lab.html` in this folder is the latest single-file build. Open it directly in Chrome, Edge, Firefox or Safari.

## What is in the box

**Boards (7):** ESP32 DevKitC V4, Arduino Uno R3, Arduino Nano, Arduino Mega 2560 Rev3, Raspberry Pi Pico, NodeMCU ESP8266 (Amica V2), STM32 Blue Pill. Each board has its own profile (`src/boards.js`): logic level, VIL/VIH, pin output resistance, GPIO capabilities (ADC, PWM, interrupts, I2C/SPI/UART pins, input-only and strapping pins), integer width (16-bit `int` on AVR), onboard LEDs, and which APIs exist (for example, `ledcWrite` is ESP32-only and `WiFi` needs a Wi-Fi board). Calling an API the selected board doesn't have is a compile error, the same as it would be in the real toolchain.

**Parts (52):** resistor, ceramic/electrolytic capacitor, inductor, diodes (1N4148, 1N4007, 1N5819 Schottky, 1N4733A Zener, …), NPN/PNP (2N2222, BC547, 2N3906, TIP120), N-MOSFET (2N7000, IRF520, IRLZ44N), 78xx/LM1117 regulators, LM358 op-amp, NE555, 74HC595, relay, DC motor, SG90 servo, active/passive buzzer, incandescent lamp, WS2812B stick, 10-segment bar, 7-segment, SSD1306 OLED, 1602 I2C LCD, push button, slide switch, tilt switch, potentiometer, KY-023 joystick, KY-040 encoder, 4×4 membrane keypad, microphone, LDR, NTC, DHT22, HC-SR04, HC-SR501 PIR, capacitive soil sensor, MQ-2, MPU-6050, DS3231, 9 V battery, AA pack, 18650 cell, bench PSU (CV/CC), function generator, multimeter, 2-channel oscilloscope, 8-channel logic analyzer, and mini/half/full breadboards.

**Projects (39):** blink, traffic light, chaser, dice/7-segment, shift-register bar graph, servo knob, ultrasonic LCD ruler, weather station, melody, keypad lock, joystick RGB, night light, thermometer, Mega chaser, Pico breathing and NeoPixel rainbow, Blue Pill interrupt, ESP8266↔ESP32 Wi-Fi remote, wired UART link between two boards, IMU tilt, RTC OLED clock, PIR alarm, plant watering (relay + pump), MOSFET motor PWM with flyback diode, 555 flasher, RC and RL transients on the scope, op-amp amplifier, 7805 regulator, Zener reference, transistor lamp switch, multimeter/ohmmeter and more. `tests/projects.test.js` runs every one of them and checks the physical result (LED current, timing, scope ratio, LCD text, etc.).

**Tools:** library with live 3D thumbnails and search; schema-driven inspector (part parameters, live readouts, board information and datasheet links); oscilloscope and logic-analyzer drawer; engineering calculators (LED resistor, Ohm's law, divider, RC/filter, 555 astable, color code); BOM CSV and SPICE netlist export; JSON project import/export (drag a `.circuitlab.json`/`.json` file in or use the open button); camera snapshot; undo/redo; autosave.

## Simulation model (and its honest limits)

`src/engine.js` builds a Modified Nodal Analysis matrix from the wiring graph and solves it with dense LU every 1 ms of simulated time, in 1/5/20 substeps (Simulation precision setting) whenever something is switching or storing energy.

- **Nonlinear devices** use Newton–Raphson with junction-voltage limiting: diode/LED Shockley models (Zener breakdown with knee resistance), Ebers–Moll-style BJTs (cut-off/active/saturation reported), square-law MOSFETs, piecewise op-amp with rail limits, regulators with dropout.
- **Energy storage** uses backward-Euler companion models, so RC/RL time constants, motor back-EMF, flyback spikes and relay coil kick are simulated, not faked. The RC project measures 63 % at τ within 2 %.
- **PWM** is real switching when the period covers at least four substeps. Otherwise it falls back to the average voltage. LED brightness is averaged over substeps the way an eye sees it.
- **Behavioural blocks:** the 555 (comparators plus flip-flop at ⅓/⅔ VCC), 74HC595, relay contacts, HC-SR04 echo timing and the DHT22 protocol are logic models with analog pins, not transistor-level netlists.
- **Buses:** I2C and SPI are logical transactions that only succeed when the actual nets connect, power and ground are present and the address matches. UART between boards is delivered byte by byte when TX and RX are electrically linked (including through resistive dividers), share a ground and meet VIH. A baud mismatch garbles the data. Wi-Fi/UDP is a virtual network (association delay, ports, loss), not RF or 802.11 frames.
- **ADC** is ideal at the board's resolution and reference. There is no ESP32 nonlinearity, noise or calibration.
- **Not modelled:** temperature, parasitic capacitance and inductance, EMI, battery chemistry beyond internal resistance and state of charge, component destruction (overloads are *diagnosed*, parts don't burn), cycle-accurate CPU timing (the VM runs at 1 ms clock resolution; `delayMicroseconds` and `micros` are quantized to it, except `pulseIn`, which uses exact edge times).

This is an educational simulator. It is not SPICE sign-off and not a safety assessment for real hardware.

## Firmware

`src/compiler.js` is a real tokenizer → preprocessor → recursive-descent parser → bytecode compiler, and a bounded stack VM per board. No `eval`.

Supported: C integer types with correct width, overflow, casts and integer division; `float`/`double`; `bool`; `char`; `String` with its methods; 1D/2D arrays and initializers; `const`, `static` locals, `volatile`, `#define`/`#include`; functions; `if/else`, `for`, `while`, `do/while`, `switch`, `break/continue`; ternary and bitwise operators; `F("…")`; `Serial.printf`.

Arduino core: `pinMode/digitalWrite/digitalRead`, `analogRead/analogWrite` (plus resolution/range/frequency variants), `ledc*`, `dacWrite`, `tone/noTone`, `pulseIn`, `shiftOut/shiftIn`, `attachInterrupt`, `millis/micros/delay`, `map/constrain/random`, `bit*`/`lowByte`/`highByte`, math functions, `EEPROM`, `Wire`, `SPI`, `Serial` (requires `Serial.begin`, as on real hardware).

Libraries (header + class API): `Servo`/`ESP32Servo`, `LiquidCrystal_I2C`, `Adafruit_SSD1306`/`Adafruit_GFX` (text, pixels, lines, rectangles, circles), `DHT`, `Adafruit_NeoPixel` (including `ColorHSV`/`gamma32`), `SoftwareSerial`, `WiFi`/`ESP8266WiFi`, `WiFiUDP`.

Not supported: pointers, structs/classes you define, templates, dynamic memory, FreeRTOS, BLE, TCP/HTTP, real board binaries, and any library not listed above. These produce a compile diagnostic, never silent misbehaviour.

## Architecture

| File | Role |
| --- | --- |
| `src/boards.js` | Board profiles and physical header geometry |
| `src/parts.js` | Part catalog: pins on the 2.54 mm grid, parameters, inspector schema, device models |
| `src/elements.js` | Per-part MNA stamps (linear, nonlinear, companion, behavioural) |
| `src/engine.js` | `Circuit` (solver, substeps, diagnostics, probes) and `Simulator` (per-board runtime API) |
| `src/compiler.js` | Language front end, bytecode, VM |
| `src/world.js`, `src/network.js` | Multi-board world, shared clock, UART links, virtual Wi-Fi |
| `src/devices.js` | I2C register devices (OLED, LCD, MPU-6050, DS3231) and the graphics display list |
| `src/geo.js`, `src/models.js`, `src/scene.js` | 3D primitives, part/board models, scene, wires, dragging, live visual state |
| `src/snap.js` | Seating parts in breadboard holes, creating contact connections |
| `src/projects.js` | The 39 example projects |
| `src/App.jsx`, `src/Panels.jsx`, `src/Editor.jsx` | UI |
| `src/sim.worker.js` | 1 ms simulation clock in a Web Worker |

## Tests

- `npm test`: 114 Node tests (`engine`, `expanded`, `physics`, `projects`).
- Browser (needs `npm run dev`; Chromium path from `$CHROMIUM` or the Playwright default): `node tests/app-tour.mjs` captures the feature tour into `screenshots/`. `tests/showcase.mjs out.png type1,type2,… [cols] [gap] [dir] [zoom]` renders any parts through the app's file import. `tests/browser-workflows.mjs`, `browser-tail.mjs`, `additional-workflows.mjs`, `drag-check.mjs`, `inspect-browser.mjs` and `visual-check.mjs` are end-to-end UI workflows.

Browser QA runs on software WebGL2 (SwiftShader). WebGPU is used when available but was not verified on real GPU hardware here.

## 3D model provenance

See [docs/HARDWARE_REFERENCE.md](docs/HARDWARE_REFERENCE.md). Board outlines, header positions and connector placement follow official drawings (Arduino/Espressif/Raspberry Pi/ST). Part bodies follow datasheet package dimensions. Small details such as SMD passives, silkscreen and textures are visual approximations and are labelled as such there.
