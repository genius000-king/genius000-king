# Circuit Lab

A browser-based 3D electronics bench. Place real-proportioned boards and parts, seat them on breadboards, wire them, write Arduino-style firmware, and watch a transient circuit solver drive every LED, motor, display and instrument. Everything (compiler, VMs, solver, network, renderer) runs locally in the browser; there is no server, account or external simulator.

## Run

```sh
npm ci
npm run dev                                         # http://127.0.0.1:5173
npm test                                            # 153 engine / compiler / physics / project tests
npm run build                                       # dist/
npx vite build --config vite.standalone.config.js   # standalone/index.html, single file, works offline
```

`Circuit-Lab.html` in this folder is the latest single-file build. Open it directly in Chrome, Edge, Firefox or Safari.

## What is in the box

**Boards (7):** ESP32 DevKitC V4, Arduino Uno R3, Arduino Nano, Arduino Mega 2560 Rev3, Raspberry Pi Pico, NodeMCU ESP8266 (Amica V2), STM32 Blue Pill. Each board has its own profile (`src/boards.js`): logic level, VIL/VIH, pin output resistance, GPIO capabilities (ADC, PWM, interrupts, I2C/SPI/UART pins, input-only and strapping pins), integer width (16-bit `int` on AVR), onboard LEDs, and which APIs exist (for example, `ledcWrite` is ESP32-only and `WiFi` needs a Wi-Fi board). Calling an API the selected board doesn't have is a compile error, the same as it would be in the real toolchain.

**Parts (84):**
- **Passive and magnetics:** resistor, ceramic/electrolytic capacitor, radial inductor, toroidal power inductor, axial choke, 230 V → 12 V / 6 V and 1:1 / audio transformers, 9-0-9 and 12-0-12 V center-tap transformers (real coupled windings with mutual inductance, so DC transfers nothing and the core saturates).
- **Semiconductors:** diodes (1N4148, 1N4007, 1N5408, 1N5819 Schottky, Zeners), bridge rectifiers (DB107, KBP307), NPN/PNP (2N2222, BC547, 2N3904, TIP120 …), MOSFETs (2N7000, IRF520, IRLZ44N, IRF9540), PC817 optocoupler.
- **ICs:** LM358, LM393 comparator, NE555, 74HC595, 74HC00/02/04/08/32/86/14, CD4017, L293D H-bridge, ULN2003 Darlington array.
- **Power:** 78xx/LD1117/LM317 regulators, LM2596 buck module, glass and PTC fuses, 6 V solar panel, 9 V battery, AA pack, 18650.
- **Outputs:** LEDs, RGB LED, bar graph, 7-segment, traffic-light module, panel voltmeter, relay, DC motor, SG90 servo, 28BYJ-48 stepper, buzzer, 8 Ω speaker, lamp, WS2812B stick, SSD1306 OLED, 1602 LCD.
- **Inputs and sensors:** button, slide/tilt/reed switches, pot, 3296W trimmer, slide pot, joystick, encoder, keypad, mic, LDR, NTC, DHT22, HC-SR04, PIR, soil, MQ-2, MPU-6050, DS3231, A3144 Hall, FC-51 IR obstacle sensor.
- **Instruments and signals:** bench PSU (CV/CC), isolated AC source (variac, 50/60 Hz), function generator, XY-LPWM PWM generator, multimeter, 2-channel oscilloscope, 8-channel logic analyzer; mini/half/full breadboards.

**Projects (56):** linear 230 V → 5 V supply (transformer, bridge, reservoir capacitor, 7805, ripple on the scope), center-tap rectifier, 555 + CD4017 chaser, half adder from 74HC gates, L293D H-bridge, ULN2003 stepper, LM317 adjustable supply, LM2596 buck, optocoupler isolation, LM393 night light, traffic-light module, solar panel, fuse protection, reed door alarm, IR obstacle detector, PWM generator on the scope, transistor-driven speaker, plus blink, traffic light, chaser, dice/7-segment, shift-register bar graph, servo knob, ultrasonic LCD ruler, weather station, melody, keypad lock, joystick RGB, night light, thermometer, Mega chaser, Pico breathing and NeoPixel rainbow, Blue Pill interrupt, ESP8266↔ESP32 Wi-Fi remote, wired UART link between two boards, IMU tilt, RTC OLED clock, PIR alarm, plant watering (relay + pump), MOSFET motor PWM with flyback diode, 555 flasher, RC and RL transients on the scope, op-amp amplifier, 7805 regulator, Zener reference, transistor lamp switch, multimeter/ohmmeter and more. `tests/projects.test.js` runs every one of them and checks the physical result (LED current, timing, scope ratio, LCD text, etc.).

**Wiring realism:** parts seated in a breadboard connect through its strips. Hole-to-hole jumpers are flat solid-core wire bent at right angles. Header wires are Dupont leads with housings. Instrument leads (PSU, generator, scope, meter, logic analyzer) drop from the jack to the bench, lie along it and drape over anything in the way.

**Hands-on controls:** press buttons, keypad keys and EN/BOOT in 3D; drag pot and encoder shafts to turn them; drag the joystick (spring-centred on release); click slide/tilt switches and the multimeter dial. `tests/hand-controls.mjs` drives these with a real mouse and checks the circuit responds (the knob turns the servo to the matching angle).

**Full screen and phones:** the ⛶ button in the top bar enters real browser full screen and a compact layout. iPhone Safari only allows full screen for video, so there the button switches to the compact layout alone. On phones the camera frames the circuit for the tall screen and turns long circuits (a board beside a breadboard) so they run up the screen. The inspector becomes a bottom sheet, controls are thumb-sized, a double-tap frames the circuit, and pinch/two-finger drag zoom and pan. Taps never fire a delayed "ghost" click on a panel that opens under the finger. `tests/mobile.mjs` checks all of this on an emulated iPhone 13.

**Tools:** library with live 3D thumbnails and search; schema-driven inspector (part parameters, live readouts, board information and datasheet links); oscilloscope and logic-analyzer drawer; engineering calculators (LED resistor, Ohm's law, divider, RC/filter, 555 astable, color code); BOM CSV and SPICE netlist export; JSON project import/export (drag a `.circuitlab.json`/`.json` file in or use the open button); camera snapshot; undo/redo; autosave.

## Simulation model (and its honest limits)

`src/engine.js` builds a Modified Nodal Analysis matrix from the wiring graph and solves it with dense LU every 1 ms of simulated time, in 1/5/20 substeps (Simulation precision setting) whenever something is switching or storing energy.

- **Nonlinear devices** use Newton–Raphson with junction-voltage limiting: diode/LED Shockley models (Zener breakdown with knee resistance), Ebers–Moll-style BJTs (cut-off/active/saturation reported), square-law MOSFETs, piecewise op-amp with rail limits, regulators with dropout.
- **Energy storage** uses backward-Euler companion models, so RC/RL time constants, motor back-EMF, flyback spikes and relay coil kick are simulated, not faked. The RC project measures 63 % at τ within 2 %.
- **Transformers** are magnetically coupled windings (mutual inductance M = 0.998·√(L₁L₂), backward Euler), not ideal voltage dividers: AC transfers at the turns ratio, DC transfers nothing and just drives the primary toward saturation (diagnosed), and winding resistance gives realistic load regulation. Real small transformers are wound ≈8 % high so they hit the rated voltage at full load; the models do the same.
- **Protection and conversion:** fuses integrate I²t with a thermal time constant (fast vs slow-blow), PTCs trip and reset when power is removed, the LM2596 module draws input current from output power ÷ efficiency.
- **PWM** is real switching when the period covers at least four substeps. Otherwise it falls back to the average voltage. LED brightness is averaged over substeps the way an eye sees it.
- **Behavioural blocks:** the 555 (comparators plus flip-flop at ⅓/⅔ VCC), 74HC595, 74HC gates (switching at VCC/2, Schmitt 74HC14 at 0.6/0.4 VCC, undefined-region warnings), CD4017, L293D, ULN2003, LM393 (open collector), PC817 (CTR), relay contacts, HC-SR04 echo timing and the DHT22 protocol are logic models with analog pins, not transistor-level netlists.
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
| `src/projects.js` | The 56 example projects |
| `src/App.jsx`, `src/Panels.jsx`, `src/Editor.jsx` | UI |
| `src/sim.worker.js` | 1 ms simulation clock in a Web Worker |

## Tests

- `npm test`: 153 Node tests (`engine`, `expanded`, `physics`, `newparts`, `projects`).
- Browser (needs `npm run dev`; Chromium path from `$CHROMIUM` or the Playwright default): `node tests/app-tour.mjs` captures the feature tour into `screenshots/`. `tests/showcase.mjs out.png type1,type2,… [cols] [gap] [dir] [zoom]` renders any parts through the app's file import. `tests/hand-controls.mjs`, `tests/mobile.mjs`, `tests/browser-workflows.mjs`, `browser-tail.mjs`, `additional-workflows.mjs`, `drag-check.mjs`, `inspect-browser.mjs` and `visual-check.mjs` are end-to-end UI workflows.

Browser QA runs on software WebGL2 (SwiftShader). WebGPU is used when available but was not verified on real GPU hardware here.

## 3D model provenance

See [docs/HARDWARE_REFERENCE.md](docs/HARDWARE_REFERENCE.md). Board outlines, header positions and connector placement follow official drawings (Arduino/Espressif/Raspberry Pi/ST). Part bodies follow datasheet package dimensions. Small details such as SMD passives, silkscreen and textures are visual approximations and are labelled as such there.
