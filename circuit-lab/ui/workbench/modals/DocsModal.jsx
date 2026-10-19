/** The in-app reference (matches the README). */
import {BookOpen, X, ExternalLink, CircuitBoard} from 'lucide-react';
import {BOARD} from '../../../engines/catalog/esp32-devkit.js';
import {IconButton} from '../../common/IconButton.jsx';
import {useWorkbench} from '../context.js';

export default function DocsModal() {
  const {setDocs} = useWorkbench();
  return (
    <div className="modal-backdrop" onPointerDown={() => setDocs(false)}>
      <div className="modal docs-modal glass" onPointerDown={e => e.stopPropagation()}>
        <div className="modal-heading">
          <span className="modal-icon">
            <BookOpen size={22} />
          </span>
          <IconButton icon={X} label="Close reference" onClick={() => setDocs(false)} />
        </div>
        <div className="eyebrow">THE CIRCUIT LAB FIELD GUIDE</div>
        <h2>Reference</h2>
        <p>
          Build a circuit, write a little code, and inspect what actually flows. Every wire is part of an
          electrical graph. Every light is driven by calculated current.
        </p>
        <div className="guide-grid">
          <div>
            <span>01</span>
            <h3>Build</h3>
            <p>
              Drag parts from the library. Use <kbd>W</kbd> to connect pins, or select terminals by name with
              the + connector tool.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Program</h3>
            <p>
              Open Code, edit the sketch, then Compile or Upload & run. The first circuit is already wired for
              a blink.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Explore</h3>
            <p>
              Press a button, move a wiper, or disconnect a wire. Check the live voltages, serial output and
              diagnostics.
            </p>
          </div>
        </div>
        <details open>
          <summary>What runs here</summary>
          <p>
            A real tokenizer, preprocessor, parser and bytecode compiler turn an Arduino-style C++ sketch into
            code for a bounded VM, one per board. Integer types keep their C widths (16-bit <code>int</code>{' '}
            on AVR, 32-bit on ESP32/RP2040/STM32), overflow, casts and integer division. Arrays (1D/2D),{' '}
            <code>switch</code>, <code>do/while</code>, <code>#define</code>, <code>static</code>,{' '}
            <code>volatile</code>, <code>String</code> and <code>Serial.printf</code> are supported.
          </p>
          <div className="api-grid">
            <code>pinMode · digitalWrite · digitalRead</code>
            <code>analogRead · analogWrite · ledcWrite · dacWrite</code>
            <code>tone · pulseIn · shiftOut · shiftIn</code>
            <code>attachInterrupt · millis · micros · delay</code>
            <code>Serial · SoftwareSerial · Wire · SPI · EEPROM</code>
            <code>Servo · LiquidCrystal_I2C · Adafruit_SSD1306</code>
            <code>DHT · Adafruit_NeoPixel · Adafruit_GFX</code>
            <code>WiFi · WiFiUDP (ESP32 / ESP8266)</code>
          </div>
          <p>
            Each board only offers what the real one has: <code>ledcWrite</code> on ESP32, <code>WiFi</code>{' '}
            on Wi-Fi boards, ADC on real ADC pins, interrupts on interrupt-capable pins. Pointers,
            user-defined classes/structs, dynamic memory, FreeRTOS, BLE, TCP/HTTP and libraries not listed
            fail with a compile diagnostic. This is not an instruction-set emulator: timing runs on a 1 ms
            clock (<code>pulseIn</code> uses exact edge times).
          </p>
        </details>
        <details>
          <summary>Developer tools</summary>
          <p>
            <b>Debugger.</b> Click left of a line number to set a breakpoint, then Run. The whole bench halts
            there, as a hardware debugger halts the chip. The Debugger tab shows the line, the locals and
            globals with their types, and the call stack. <kbd>F10</kbd> step over, <kbd>F11</kbd> step into,{' '}
            <kbd>Shift</kbd>+<kbd>F11</kbd> step out, <kbd>F8</kbd> continue.
          </p>
          <p>
            <b>Serial Plotter.</b> Print numbers, one sample per line; <code>label:value</code> pairs name the
            series, as in the Arduino IDE.
          </p>
          <p>
            <b>RAM.</b> After compiling, the meter next to “Build ready” shows how much RAM the sketch’s
            global variables use on this board (the AVR core and Serial/Wire buffers included on AVR). Above
            75 % the sketch is likely to misbehave, as the IDE warns. Flash is not estimated.
          </p>
          <p>
            <b>Exports.</b> Logic analyzer → VCD (PulseView, GTKWave); oscilloscope → CSV.
          </p>
        </details>
        <details>
          <summary>Electrical model & timing</summary>
          <p>
            Modified nodal analysis solved every simulated millisecond, with 1/5/20 substeps (Simulation
            precision) while anything is switching or storing energy. Diodes, LEDs and Zeners use exponential
            junction models with Newton–Raphson and voltage limiting. BJTs use an Ebers–Moll-style model and
            MOSFETs a square law with a body diode. The op-amp saturates at its rails and regulators drop out.
            Capacitors and inductors use backward-Euler companions, so RC/RL time constants, motor back-EMF
            and relay or flyback kicks really happen. Transformers are coupled windings with mutual
            inductance: AC transfers at the turns ratio, DC transfers nothing. Fuses integrate I²t and blow;
            PTCs trip and reset.
          </p>
          <p>
            PWM truly switches when its period spans at least four substeps and is averaged otherwise. LED
            brightness is the time average, the way the eye sees it. The 555, 74HC595, relay contacts, HC-SR04
            and DHT22 are behavioural models with analog pins. I²C and SPI transactions only succeed through
            actually connected, powered, grounded nets with the right address. UART between boards is
            delivered byte by byte when TX and RX are electrically linked and meet the logic threshold;
            mismatched baud rates garble data. Wi-Fi/UDP is a virtual network, not RF.
          </p>
          <p>
            Not modelled: temperature, parasitics, EMI, battery chemistry beyond internal resistance and
            charge, ADC noise/nonlinearity, and component destruction (overloads are diagnosed, parts never
            burn). It is an educational simulator, not SPICE sign-off or a safety assessment.
          </p>
        </details>
        <details>
          <summary>Hardware provenance</summary>
          <p>
            Board outlines and header positions follow official drawings: Arduino Uno R3 (68.58 × 53.34 mm
            shield grid), Mega 2560, Nano (0.6" rows), Raspberry Pi Pico (21 × 51 mm, 0.7" rows),
            ESP32-DevKitC V4 (27.94 × 48.26 mm, 25.40 mm row spacing), plus vendor-consensus outlines for the
            NodeMCU Amica and the Blue Pill. Part bodies use datasheet packages (T-1¾ LED, DO-35/41, TO-92,
            TO-220, DIP, SRD relay, WS2812B 5050, DHT22). Silkscreen, small SMD parts and bench instruments
            are visual approximations. The full table with sources is in docs/HARDWARE_REFERENCE.md.
          </p>
          <div className="reference-links">
            {BOARD.sources.map(s => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {s.title}
                <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </details>
        <details>
          <summary>Controls, persistence & recovery</summary>
          <p>
            Operate parts by hand: press buttons, keypad keys and EN/BOOT; drag a potentiometer or encoder
            shaft to turn it; drag the joystick (it springs back to centre when released, press it without
            dragging to click); click a slide switch, the tilt switch or the multimeter dial.
          </p>
          <p>
            The ⛶ button in the top bar enters full screen. On a phone: tap to select (the inspector opens as
            a sheet at the bottom), double-tap to frame the circuit, pinch to zoom, drag with two fingers to
            pan.
          </p>
          <p>
            Drag a component to move it. Drag empty space to orbit, right-drag to pan, and scroll to zoom.
            Shift-click selects multiple objects. <kbd>R</kbd> opens rotation handles; the inspector provides
            exact X/Y/Z values and a 180° underside flip. Set a positive Y position to lift a part.{' '}
            <kbd>F</kbd> focuses the camera. <kbd>⌘D</kbd> duplicates, <kbd>Delete</kbd> removes,{' '}
            <kbd>⌘Z</kbd> undoes, and <kbd>Space</kbd> runs or pauses.
          </p>
          <p>
            Projects autosave in this browser. Open or drop a <code>.circuitlab.json</code> project to load
            it, or an <code>.ino</code>/<code>.cpp</code>/<code>.h</code> file to add it to the sketch. Manual
            save, JSON/BOM CSV/SPICE netlist export and validated import are in the project menu. Parts
            dropped onto a breadboard seat into its holes and connect through its strips. Stored state
            includes component transforms, parameters, wires, source files, layout and camera; a running VM is
            restarted after reload. Import errors preserve the current project. CodeMirror offers search and
            replace with Ctrl / Cmd + F. Use Export to move projects between devices. Up to 200 parts and
            2,000 wires can be stored; the electrical solver is bounded to 700 active nets. Unused breadboard
            strips do not consume solver capacity. Automatic wire paths clear component bounding boxes and
            separate crossing heights; custom routes remain unrestricted. Crossing wires do not create a
            junction.
          </p>
        </details>
        <div className="guide-foot">
          <CircuitBoard size={17} />
          <span>Made for curiosity. Built on real connections.</span>
        </div>
      </div>
    </div>
  );
}
