import {regPins, REG_MODELS, FUSE_MODELS} from '../device-models.js';
import {select, ro, num, I, range, V} from '../schema.js';

export const powerParts = {
  regulator: {
    name: 'Voltage regulator',
    subtitle: 'Linear LDO / 78xx',
    spec: 'LM7805',
    category: 'Power',
    size: [10, 4.5],
    params: {model: 'LM7805'},
    pins: regPins,
    controls: [
      select(
        'model',
        'Part number',
        Object.keys(REG_MODELS).map(k => [k, k])
      ),
    ],
    readouts: [
      ro('vin', 'Input', 'V', 1, 3),
      ro('vout', 'Output', 'V', 1, 3),
      ro('iout', 'Load', 'mA', 1000, 1),
      ro('dissipation', 'Dissipation', 'W', 1, 2),
    ],
  },
  battery: {
    name: 'Battery 9 V',
    subtitle: 'Alkaline PP3',
    spec: '9 V',
    category: 'Power',
    size: [26.5, 17.5],
    params: {voltage: 9, internalResistance: 2, maxCurrent: 200, capacity: 550},
    pins: [
      ['+', -5, 49, 0],
      ['-', 5, 49, 0],
    ],
    controls: [
      num('voltage', 'Source voltage', 0, 24, 0.1, 'V'),
      num('internalResistance', 'Internal resistance', 0.1, 100, 0.1, 'Ω'),
      num('maxCurrent', 'Rated current', 1, 5000, 1, 'mA'),
      num('capacity', 'Capacity', 1, 100000, 1, 'mAh'),
    ],
    readouts: [ro('voltage', 'Terminal', 'V', 1, 3), I, ro('soc', 'Charge', '%', 100, 1)],
  },
  aapack: {
    name: 'AA battery pack',
    subtitle: 'Alkaline cells in holder',
    spec: '2 × AA',
    category: 'Power',
    size: [32, 58],
    params: {cells: 2, capacity: 2500},
    pins: [
      ['+', -2.54, 1, 34, 'Red lead'],
      ['-', 2.54, 1, 34, 'Black lead'],
    ],
    controls: [
      select('cells', 'Cells', [
        [1, '1 × AA · 1.5 V'],
        [2, '2 × AA · 3 V'],
        [3, '3 × AA · 4.5 V'],
        [4, '4 × AA · 6 V'],
      ]),
    ],
    readouts: [ro('voltage', 'Terminal', 'V', 1, 3), I, ro('soc', 'Charge', '%', 100, 1)],
  },
  lipo: {
    name: 'Li-ion cell',
    subtitle: '18650 · 3.7 V nominal',
    spec: '18650',
    category: 'Power',
    size: [21, 77],
    params: {capacity: 2500, soc: 0.85},
    pins: [
      ['+', -2.54, 1, 44, 'Red lead'],
      ['-', 2.54, 1, 44, 'Black lead'],
    ],
    controls: [range('soc', 'State of charge', 0, 1, 0.01, '%', {scale: 100})],
    readouts: [ro('voltage', 'Terminal', 'V', 1, 3), I, ro('soc', 'Charge', '%', 100, 1)],
  },
  lm317: {
    name: 'LM317',
    subtitle: 'Adjustable regulator · 1.25–37 V',
    spec: 'TO-220',
    category: 'Power',
    size: [10, 4.5],
    params: {},
    pins: [
      ['ADJ', -2.54, 1, 0, 'Adjust · Vout = 1.25 V × (1 + R2/R1)'],
      ['OUT', 0, 1, 0, 'Output'],
      ['IN', 2.54, 1, 0, 'Input'],
    ],
    readouts: [
      ro('vin', 'Input', 'V', 1, 3),
      ro('vout', 'Output', 'V', 1, 3),
      ro('iout', 'Load', 'mA', 1000, 1),
      ro('dissipation', 'Dissipation', 'W', 1, 2),
    ],
    note: 'Keeps 1.25 V between OUT and ADJ. Classic divider: 240 Ω from OUT to ADJ, a pot from ADJ to GND.',
  },
  buck: {
    name: 'Buck converter',
    subtitle: 'LM2596 module · up to 3 A',
    spec: 'LM2596',
    category: 'Power',
    size: [43, 21],
    params: {vout: 5, efficiency: 0.88},
    pins: [
      ['IN+', -20.32, 1, -6.35, 'Input + (4.5–40 V)'],
      ['IN-', -20.32, 1, 6.35, 'Input −'],
      ['OUT+', 20.32, 1, -6.35, 'Output +'],
      ['OUT-', 20.32, 1, 6.35, 'Output −'],
    ],
    joins: [['IN-', 'OUT-']],
    controls: [
      range('vout', 'Output (trimmer)', 1.25, 35, 0.05, 'V'),
      range('efficiency', 'Efficiency', 0.6, 0.95, 0.01, '%', {scale: 100}),
    ],
    readouts: [
      ro('vin', 'Input', 'V', 1, 3),
      ro('vout', 'Output', 'V', 1, 3),
      ro('iout', 'Load', 'mA', 1000, 1),
      ro('iin', 'Input current', 'mA', 1000, 1),
    ],
  },
  solar: {
    name: 'Solar panel',
    subtitle: '6 V 1 W polycrystalline · 12 cells',
    spec: '6 V 1 W',
    category: 'Power',
    size: [110, 60],
    params: {irradiance: 800},
    pins: [
      ['+', -2.54, 1, 34, 'Red lead'],
      ['-', 2.54, 1, 34, 'Black lead'],
    ],
    controls: [range('irradiance', 'Sunlight', 0, 1200, 10, 'W/m²')],
    readouts: [V, I, ro('power', 'Power', 'mW', 1000, 0)],
    note: 'Voc ≈ 7.2 V and Isc ≈ 200 mA at 1000 W/m². Current scales with sunlight; voltage barely changes until the load pulls it down.',
  },
  fuse: {
    name: 'Fuse',
    subtitle: '5 × 20 mm in PCB holder',
    spec: 'F500MA',
    category: 'Power',
    size: [27, 8],
    params: {model: 'F500mA · fast glass 5×20', replace: false},
    pins: [
      ['A', -11.43, 1, 0],
      ['B', 11.43, 1, 0],
    ],
    controls: [
      select(
        'model',
        'Fuse',
        Object.keys(FUSE_MODELS).map(k => [k, k])
      ),
      {key: 'replace', label: 'Replace fuse', type: 'momentary'},
    ],
    readouts: [I, ro('state', 'State', '')],
  },
};
