import {DIODE_MODELS, bjtPins, BJT_MODELS, mosPins, MOS_MODELS, BRIDGE_MODELS} from '../device-models.js';
import {select, V, I, ro, dip, range} from '../schema.js';

export const semiconductorsParts = {
  diode: {
    name: 'Diode',
    subtitle: 'Rectifier · signal · Schottky · Zener',
    spec: '1N4007',
    category: 'Semiconductors',
    size: [10, 3],
    params: {model: '1N4007'},
    pins: [
      ['A', -5.08, 1, 0, 'Anode'],
      ['K', 5.08, 1, 0, 'Cathode · banded end'],
    ],
    controls: [
      select(
        'model',
        'Part number',
        Object.keys(DIODE_MODELS).map(k => [k, k])
      ),
    ],
    readouts: [V, I],
  },
  npn: {
    name: 'NPN transistor',
    subtitle: 'Ebers–Moll BJT',
    spec: '2N2222A',
    category: 'Semiconductors',
    size: [5, 4],
    params: {model: '2N2222A'},
    pins: bjtPins,
    controls: [
      select(
        'model',
        'Part number',
        Object.entries(BJT_MODELS)
          .filter(([, m]) => m.npn)
          .map(([k]) => [k, k])
      ),
    ],
    readouts: [
      ro('vbe', 'V BE', 'V', 1, 3),
      ro('vce', 'V CE', 'V', 1, 3),
      ro('ib', 'I B', 'mA', 1000, 3),
      ro('ic', 'I C', 'mA', 1000, 2),
      ro('region', 'Region', ''),
    ],
  },
  pnp: {
    name: 'PNP transistor',
    subtitle: 'Ebers–Moll BJT',
    spec: '2N2907A',
    category: 'Semiconductors',
    size: [5, 4],
    params: {model: '2N2907A'},
    pins: bjtPins,
    controls: [
      select(
        'model',
        'Part number',
        Object.entries(BJT_MODELS)
          .filter(([, m]) => !m.npn)
          .map(([k]) => [k, k])
      ),
    ],
    readouts: [
      ro('vbe', 'V EB', 'V', 1, 3),
      ro('vce', 'V EC', 'V', 1, 3),
      ro('ib', 'I B', 'mA', 1000, 3),
      ro('ic', 'I C', 'mA', 1000, 2),
      ro('region', 'Region', ''),
    ],
  },
  mosfet: {
    name: 'MOSFET',
    subtitle: 'Square-law + body diode',
    spec: 'IRLZ44N',
    category: 'Semiconductors',
    size: [10, 4.5],
    params: {model: 'IRLZ44N'},
    pins: mosPins,
    controls: [
      select(
        'model',
        'Part number',
        Object.keys(MOS_MODELS).map(k => [k, k])
      ),
    ],
    readouts: [
      ro('vgs', 'V GS', 'V', 1, 3),
      ro('vds', 'V DS', 'V', 1, 3),
      ro('id', 'I D', 'mA', 1000, 2),
      ro('region', 'Region', ''),
    ],
  },
  pc817: {
    name: 'PC817 optocoupler',
    subtitle: 'LED + phototransistor · 5 kV isolation',
    spec: 'DIP-4',
    category: 'Semiconductors',
    size: [4.6, 6.5],
    params: {ctr: 1},
    pins: dip(['A', 'K', 'E', 'C']),
    controls: [range('ctr', 'Current transfer ratio', 0.5, 6, 0.05, '%', {scale: 100})],
    readouts: [ro('if', 'LED current', 'mA', 1000, 2), ro('ic', 'Collector current', 'mA', 1000, 2)],
  },
  bridge: {
    name: 'Bridge rectifier',
    subtitle: 'Four diodes · full wave',
    spec: 'DB107',
    category: 'Semiconductors',
    size: [8.3, 6.5],
    params: {model: 'DB107 · 1 A 1000 V'},
    pins: [
      ['+', -2.54, 1, 3.81, 'DC +'],
      ['AC1', 2.54, 1, 3.81, 'AC ~'],
      ['AC2', 2.54, 1, -3.81, 'AC ~'],
      ['-', -2.54, 1, -3.81, 'DC −'],
    ],
    controls: [
      select(
        'model',
        'Part number',
        Object.keys(BRIDGE_MODELS).map(k => [k, k])
      ),
    ],
    readouts: [ro('vdc', 'DC output', 'V', 1, 3), ro('current', 'Current', 'mA', 1000, 1)],
  },
};
