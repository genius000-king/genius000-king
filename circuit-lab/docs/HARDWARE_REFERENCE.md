# Circuit Lab authoritative hardware reference

Selected product: **Espressif ESP32-DevKitC V4, ordering code ESP32-DevKitC-32E, ESP32-WROOM-32E-N4 module** (4 MB QSPI flash, no PSRAM, PCB antenna). Board schematic revision **V4**, dated **2020-02-25**. Model documentation snapshot fetched 2026-10-15. Current product guide explicitly identifies the 32E ordering variant and shows WROOM-32E fitted to V4.

## Official sources

1. Product guide, header tables, board photo, ordering variant: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html
2. V4 dimension drawing: https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf
3. Same drawing DXF: https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.dxf
4. V4 schematic: https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_sch.pdf
5. V4 PCB layout: https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_pcb_layout.pdf
6. WROOM-32E / WROOM-32UE datasheet v2.1, pp. 3, 13–15, 25–29, 40: https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf
7. ESP32 SoC datasheet v5.3, Appendix A notes: https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf

## Verified geometry (millimeters)

- Carrier PCB outline: **27.94 wide × 48.26 long**, excluding projecting module antenna.
- Header centerline separation: **25.40**.
- Header pitch: **2.54**, **19 positions per side / 38 total**. Span between first and last centers is **45.72**, mathematically derived from 18 × 2.54.
- Dimension drawing marks the right column centerline-to-edge distance **1.30** and bottom edge-to-last-pin center **1.29**. Do not replace these labels with invented manufacturing tolerances.
- The generic V4 drawing marks the antenna projection beyond the PCB as **6.04**, and module width as **18.00**. It depicts an earlier module outline; do not claim that all its module details specify the current WROOM-32E revision.
- WROOM-32E actual module dimensions: **18.0 ±0.15 wide × 25.5 ±0.15 long × 3.1 ±0.15 high** (module datasheet Figure 10).
- Module Figure 10 gives PCB base thickness **0.8**, shield width **15.8**, top-edge-to-shield boundary **6.19**, castellated contact pitch **1.27**, and 38 contacts. Refer directly to the figure for which dimension belongs to which feature.
- No separate mounting screw holes appear in the official drawing/layout. Header through holes are not screw mounting holes.

## Geometry that must remain an approximation

Carrier PCB thickness, carrier corner radius, header pin square cross-section and exposed pin lengths, solder menisci, solder mask thickness, USB receptacle exact housing/contact geometry, switch dimensions/travel, absolute SMD body geometry and placement inferred from drawing/photo, antenna trace widths/keep-out microgeometry. The supplied official dimension sheet does not dimension these. A chosen conventional PCB thickness (e.g. 1.6) must be tagged `estimated`, not `verified`. Likewise, if 6.04 antenna projection is reused for the current 32E model, tag its placement as an estimate. Component placement can be based on the official PCB layout but is not an independently specified mechanical tolerance.

## Orientation and exact header pin order

Top view, antenna at top and Micro-B USB at bottom. J2 is the **left** side; J3 is the **right** side. Both pin 1 positions are at the antenna end. Arrays below are top-to-bottom (pin 1 through pin 19):

```
J2 = [3V3, EN, VP, VN, IO34, IO35, IO32, IO33, IO25, IO26,
      IO27, IO14, IO12, GND, IO13, D2, D3, CMD, 5V]
J3 = [GND, IO23, IO22, TX, RX, IO21, GND, IO19, IO18, IO5,
      IO17, IO16, IO4, IO0, IO2, IO15, D1, D0, CLK]
```

VP = GPIO36, VN = GPIO39, TX = GPIO1, RX = GPIO3. D2 = GPIO9, D3 = GPIO10, CMD = GPIO11, D1 = GPIO8, D0 = GPIO7, CLK = GPIO6.

ADC1 mappings exposed: GPIO36→CH0, GPIO39→CH3, GPIO32→CH4, GPIO33→CH5, GPIO34→CH6, GPIO35→CH7.
ADC2 mappings: GPIO4→CH0, 0→CH1, 2→CH2, 15→CH3, 13→CH4, 12→CH5, 14→CH6, 27→CH7, 25→CH8, 26→CH9. GPIO25/26 also DAC1/2.

## Electrical/boot constraints to enforce or explicitly mark unsupported

- GPIO34–39 are **input-only** and have **no internal pull-up or pull-down**. Only 34,35,36,39 are exposed here.
- GPIO6–11 are reserved for module flash; user wiring can disrupt operation. Reject them as general firmware output pins in a simplified simulator.
- GPIO16 and GPIO17 are available on this no-PSRAM WROOM-32E-N4 variant. Do not apply WROVER reservations to this board.
- Module recommended VDD33 = **3.0–3.6 V**, nominal 3.3 V. Absolute max VDD33 = 3.6 V. 5 V GPIO is invalid. At 3.3 V, guaranteed logic input HIGH is ≥0.75 VDD (2.475 V), LOW ≤0.25 VDD (0.825 V). Intermediate voltage is indeterminate.
- Internal pull resistors typical **45 kΩ**, not exact guaranteed values.
- ADC is 12-bit, but a linear 0–3.3 V → 0–4095 conversion is a simulation abstraction, not a claim of silicon accuracy. Official effective calibrated ranges depend on attenuation; at highest setting the characterized range is 150–2450 mV and accuracy worsens above approx. 2450 mV. Document idealized ADC transfer and unsupported noise/calibration/Wi-Fi effects if simplified.
- Strapping pins: GPIO0 pull-up, GPIO2 pull-down, GPIO12/MTDI pull-down, GPIO15/MTDO pull-up, GPIO5 pull-up. Sample at reset, then usable as normal IO. GPIO0 HIGH selects SPI boot; GPIO0 LOW plus GPIO2 LOW selects download boot. GPIO12 HIGH changes flash supply selection to 1.8 V; can prevent boot for this 3.3 V flash module.
- EN/CHIP_PU is reset/shutdown. BOOT is a switch from GPIO0 to GND. Holding BOOT then pressing/releasing EN enters download boot under valid GPIO2 level.
- The board's red LED is a **5 V power LED**, **not a GPIO2 user LED**. Its schematic series resistor R2 is 2 kΩ. An external GPIO2 LED must be a separately added component.
- Power sources are mutually exclusive: USB Micro-B, 5V/GND header, OR 3V3/GND header.
- Official V4 2020 schematic identifies **AMS1117-3.3**, **CP2102N-A02-GQFN28**, SS8050-G auto-program transistors, Micro-B USB, EN and BOOT switches. Some official photos show older fitted bridge/regulator variants; use the chosen schematic identification while marking unverified package mechanical details as estimates.
- EN pull-up R11 is 10 kΩ. C15 is marked not fitted in the 2020 schematic; earlier V4 C15 can force download mode or affect GPIO0 clock output.

---

# Additional boards and parts (modelled dimensions and sources)

Each value below is what the 3D model and pin map use. **Official** means it comes from a manufacturer drawing or datasheet. **Vendor** means the figure is the consensus of distributor or vendor listings for clone modules, which have no single official drawing. Silkscreen, SMD passives and textures are visual approximations on every model.

## Boards

| Board | Modelled outline (mm) | Key geometry | Status | Source |
| --- | --- | --- | --- | --- |
| Arduino Uno R3 | 68.58 × 53.34 | Shield header positions from the inch grid of the reference design (digital 0–7 offset 0.16" from 8–13); USB-B and DC jack overhang the left edge; 4 mounting holes | Official | https://docs.arduino.cc/hardware/uno-rev3/ (Eagle files, shield drawing) |
| Arduino Mega 2560 Rev3 | 101.6 × 53.34 | Same shield headers as the Uno, plus the 2 × 18 double header at the right end | Official | https://docs.arduino.cc/hardware/mega-2560/ |
| Arduino Nano | 18 × 45 | 2 × 15 pins, rows 15.24 apart (0.6"), Mini-USB | Official | https://docs.arduino.cc/hardware/nano/ |
| Raspberry Pi Pico | 21 × 51 × 1 | 2 × 20 castellated pins, rows 17.78 apart (0.7"); 4 × Ø2.1 holes on an 11.4 × 47 grid; Micro-USB; BOOTSEL; RP2040 7 × 7 QFN-56 (marking RP2-B2) | Official | https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf (§ Mechanical specification) |
| NodeMCU ESP8266 Amica V2 | 25.6 × 48.3 | 2 × 15 pins, rows 22.86 apart (0.9"); ESP-12 module with meander antenna; CP2102 | Vendor | https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf, https://www.etechnophiles.com/nodemcu-esp8266-pinout-specs-board-layout/ |
| STM32 Blue Pill | 53 × 22.86 | 2 × 20 pins, rows 15.24 apart; BOOT0/BOOT1 jumpers; 4-pin SWD header; PC13 LED (active low) | Vendor (listings give 53–53.3 × 22–23) | https://stm32-base.org/boards/STM32F103C8T6-Blue-Pill, https://www.st.com/resource/en/datasheet/stm32f103c8.pdf |

## Packages and modules

| Part | Modelled body (mm) | Status | Basis |
| --- | --- | --- | --- |
| 5 mm LED | Ø5.0 lens, Ø5.8 flange, 8.6 tall, 2.54 lead pitch, flat on the cathode side | Official (typical T-1¾ datasheet) | e.g. Kingbright L-53 series drawing |
| ¼ W resistor | 6.3 × Ø2.4 body, colour bands from the configured value | Official (typical) | Yageo CFR-25 datasheet |
| DO-35 / DO-41 diode | Ø1.85 × 4.25 / Ø2.7 × 5.2, cathode band | Official | 1N4148 / 1N4007 datasheets |
| TO-92 (BJT, 2N7000) | 4.8 wide × 5.2 tall, 1.27 pitch | Official | JEDEC TO-92 |
| TO-220 (IRF520, IRLZ44N, 78xx, TIP120) | 10.16 × 15.1 body, 2.54 pitch, Ø3.7 tab hole | Official | JEDEC TO-220AB |
| DIP-8 / DIP-16 | 9.8 / 19.8 × 6.35 body, 7.62 row spacing | Official | JEDEC MS-001 |
| SRD-05VDC-SL-C relay | 19.0 × 15.5 × 15.3 | Official | Songle SRD datasheet |
| SG90 micro servo | 22.2 × 11.8 × 31, tabs 32.2 | Vendor (TowerPro sheet) | TowerPro SG90 datasheet |
| 130 DC motor | Ø20 can with 15.1 flats × 25, Ø2 shaft | Vendor | Generic FA-130 drawings |
| WS2812B | 5.0 × 5.0 × 1.6 | Official | Worldsemi WS2812B datasheet |
| 1602 LCD + PCF8574 | 80 × 36 PCB, 64.5 × 16 viewing area | Vendor | Common 1602A drawing |
| SSD1306 0.96" OLED | 27 × 27 PCB | Vendor | Common module listings |
| HC-SR04 | 45 × 20 PCB, Ø16 transducers | Vendor | Cytron/ElecFreaks HC-SR04 user manual |
| HC-SR501 PIR | 32 × 24 PCB, Ø23 Fresnel dome | Vendor | HC-SR501 module manual |
| DHT22 / AM2302 | 15.1 × 25 × 7.7 body, 4 pins at 2.54 | Official | Aosong AM2302 datasheet |
| MQ-2 module | 32 × 22 PCB, stainless mesh head on bakelite base | Vendor | Hanwei MQ-2 datasheet (sensor), module listings |
| MPU-6050 GY-521 | 21 × 16 PCB, QFN-24 4 × 4 | Vendor / Official chip | InvenSense MPU-6000/6050 datasheet |
| DS3231 ZS-042 | 38 × 22 PCB, CR2032 holder underneath | Vendor | Module listings |
| Capacitive soil sensor v1.2 | 98 × 23 × 1.6, pointed probe, electrodes under solder mask, TLC555, 662K regulator, white JST-PH 3-pin | Vendor (98 × 23 per Cirkit Designer; other listings 99–109 × 16–23) | https://docs.cirkitdesigner.com/component/5601d0b4-d330-4084-8a86-bd2449b0d815/capacitive-soil-moisture-sensor-v12, https://tinkered.ai/components/capacitive-soil-moisture-v12 |
| 4 × 4 membrane keypad | 69 × 77 × 0.8 laminate, 8-way FFC tail, 2.54 female housing | Vendor | Common module listings |
| KY-023 joystick | 34 × 26 PCB, PS2-style gimbal in a steel frame, concave thumbcap | Vendor | Module listings |
| KY-040 encoder | 26 × 19 PCB, knurled D shaft | Vendor | Module listings |
| PP3 9 V battery | 48.5 × 26.5 × 17.5 | Official | IEC 6LR61 |
| AA cell / 18650 | Ø14.5 × 50.5 / Ø18.6 × 65.2 | Official | IEC LR6 / typical 18650 cell |
| Breadboards | 2.54 grid; 830-point 165 × 54.5, 400-point 82.5 × 54.5, 170-point 46 × 35 | Vendor | Common solderless breadboard listings |

Bench instruments (PSU, function generator, oscilloscope, multimeter, logic analyzer) are generic designs at a plausible bench scale. They do not reproduce any specific brand.
