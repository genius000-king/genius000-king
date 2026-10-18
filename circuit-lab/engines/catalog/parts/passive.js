import {TRANSFORMER_MODELS, CT_TRANSFORMER_MODELS} from '../device-models.js';
import {num, V, I, P, select, ro} from '../schema.js';

export const passiveParts = {
  resistor: {
    name: 'Resistor',
    subtitle: '¼ W carbon film',
    spec: '¼ W',
    category: 'Passive',
    size: [12, 3],
    params: {resistance: 220},
    pins: [
      ['A', -5.08, 1, 0],
      ['B', 5.08, 1, 0],
    ],
    controls: [
      num('resistance', 'Resistance', 1, 10000000, 1, 'Ω', {
        presets: [10, 100, 220, 330, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000, 1000000],
      }),
    ],
    readouts: [V, I, P],
  },
  capacitor: {
    name: 'Ceramic capacitor',
    subtitle: 'Non-polarized',
    spec: '100 NF',
    category: 'Passive',
    size: [4, 3],
    params: {capacitance: 100e-9, rating: 50},
    pins: [
      ['A', -1.27, 1, 0],
      ['B', 1.27, 1, 0],
    ],
    controls: [
      num('capacitance', 'Capacitance', 0.001, 1000, 0.001, 'µF', {scale: 1e6}),
      num('rating', 'Voltage rating', 1, 1000, 1, 'V'),
    ],
    readouts: [V, I],
  },
  electrolytic: {
    name: 'Electrolytic capacitor',
    subtitle: 'Polarized aluminium',
    spec: '100 µF',
    category: 'Passive',
    size: [6.3, 6.3],
    params: {capacitance: 100e-6, rating: 16},
    pins: [
      ['+', -1.27, 1, 0, 'Positive · longer leg'],
      ['-', 1.27, 1, 0, 'Negative · stripe side'],
    ],
    controls: [
      num('capacitance', 'Capacitance', 0.1, 10000, 0.1, 'µF', {scale: 1e6}),
      num('rating', 'Voltage rating', 4, 450, 1, 'V'),
    ],
    readouts: [V, I],
  },
  inductor: {
    name: 'Inductor',
    subtitle: 'Radial drum core coil',
    spec: '10 MH',
    category: 'Passive',
    size: [8, 8],
    params: {inductance: 10e-3, dcr: 2, maxCurrent: 500},
    pins: [
      ['A', -2.54, 1, 0],
      ['B', 2.54, 1, 0],
    ],
    controls: [
      num('inductance', 'Inductance', 0.001, 10000, 0.001, 'mH', {scale: 1e3}),
      num('dcr', 'Winding resistance', 0.01, 1000, 0.01, 'Ω'),
      num('maxCurrent', 'Rated current', 1, 10000, 1, 'mA'),
    ],
    readouts: [V, I],
  },
  transformer: {
    name: 'Transformer',
    subtitle: 'EI core · step-down',
    spec: '230/12 V',
    category: 'Passive',
    size: [48, 40],
    params: {model: '230 V → 12 V · 12 VA (EI-48)'},
    pins: [
      ['P1', -17.78, 1, -7.62, 'Primary'],
      ['P2', -17.78, 1, 7.62, 'Primary'],
      ['S1', 17.78, 1, -7.62, 'Secondary'],
      ['S2', 17.78, 1, 7.62, 'Secondary'],
    ],
    controls: [
      select(
        'model',
        'Winding',
        Object.keys(TRANSFORMER_MODELS).map(k => [k, k])
      ),
    ],
    readouts: [
      ro('vp', 'Primary', 'V', 1, 2),
      ro('vs', 'Secondary', 'V', 1, 2),
      ro('is', 'Secondary current', 'mA', 1000, 1),
    ],
    note: 'Coupled windings: only changing current transfers energy, so DC on the primary gives nothing out and just heats the winding.',
  },
  transformerct: {
    name: 'Center-tap transformer',
    subtitle: 'EI core · dual secondary',
    spec: '9-0-9 V',
    category: 'Passive',
    size: [48, 40],
    params: {model: '230 V → 9-0-9 V · 6 VA'},
    pins: [
      ['P1', -17.78, 1, -7.62, 'Primary'],
      ['P2', -17.78, 1, 7.62, 'Primary'],
      ['S1', 17.78, 1, -7.62, 'Secondary end'],
      ['CT', 17.78, 1, 0, 'Center tap'],
      ['S2', 17.78, 1, 7.62, 'Secondary end'],
    ],
    controls: [
      select(
        'model',
        'Winding',
        Object.keys(CT_TRANSFORMER_MODELS).map(k => [k, k])
      ),
    ],
    readouts: [ro('vp', 'Primary', 'V', 1, 2), ro('vs', 'Each half', 'V', 1, 2)],
  },
  toroid: {
    name: 'Toroidal inductor',
    subtitle: 'Power choke on ferrite ring',
    spec: '100 µH',
    category: 'Passive',
    size: [13, 13],
    params: {inductance: 100e-6, dcr: 0.05, maxCurrent: 3000},
    pins: [
      ['A', -2.54, 1, 0],
      ['B', 2.54, 1, 0],
    ],
    controls: [
      num('inductance', 'Inductance', 0.001, 100, 0.001, 'mH', {scale: 1e3}),
      num('dcr', 'Winding resistance', 0.001, 100, 0.001, 'Ω'),
      num('maxCurrent', 'Saturation current', 10, 20000, 10, 'mA'),
    ],
    readouts: [V, I],
  },
  choke: {
    name: 'Axial inductor',
    subtitle: 'Color-coded choke',
    spec: '10 µH',
    category: 'Passive',
    size: [10, 3.5],
    params: {inductance: 10e-6, dcr: 0.3, maxCurrent: 400},
    pins: [
      ['A', -5.08, 1, 0],
      ['B', 5.08, 1, 0],
    ],
    controls: [
      num('inductance', 'Inductance', 0.0001, 100, 0.0001, 'mH', {scale: 1e3}),
      num('dcr', 'Winding resistance', 0.001, 100, 0.001, 'Ω'),
      num('maxCurrent', 'Rated current', 1, 5000, 1, 'mA'),
    ],
    readouts: [V, I],
  },
};
