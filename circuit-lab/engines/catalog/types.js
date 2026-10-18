import {PROFILES, profileOf, boardPinInfo} from './boards.js';
import {BREADBOARD_TOP, breadboardTerminals} from './breadboards.js';
import {PARTS} from './parts/index.js';

export const MM = 1;

export const BOARD_SUBTITLES = {
  board: 'Dual-core Wi-Fi + Bluetooth',
  uno: 'The classic ATmega328P',
  nano: 'Breadboard-sized ATmega328P',
  mega: '54 digital · 16 analog pins',
  pico: 'RP2040 dual Cortex-M0+',
  esp8266: 'ESP8266 Wi-Fi in DIP form',
  bluepill: 'STM32F103 Cortex-M3',
};

export const TYPES = {
  ...Object.fromEntries(
    Object.values(PROFILES).map(b => [
      b.key,
      {
        name: b.key === 'board' ? 'ESP32 DevKit' : b.name,
        subtitle: BOARD_SUBTITLES[b.key],
        spec: b.short.toUpperCase(),
        category: 'Boards',
        size: b.size,
        params: {},
        board: true,
      },
    ])
  ),
  ...PARTS,
};

export const CATEGORIES = [
  'All',
  'Boards',
  'Inputs',
  'Sensors',
  'Outputs',
  'Passive',
  'Semiconductors',
  'ICs',
  'Power',
  'Instruments',
  'Prototyping',
];

export const isBreadboard = c => !!PARTS[typeof c === 'string' ? c : c?.type]?.breadboard;

export const breadboardTop = c => BREADBOARD_TOP[PARTS[c.type]?.breadboard] ?? 0;

export const termCache = new Map();

export function terminals(c) {
  const prof = profileOf(c);
  if (prof) {
    if (!termCache.has(prof.key))
      termCache.set(
        prof.key,
        prof.pins.map(t => ({...t, info: boardPinInfo(prof, t)}))
      );
    return termCache.get(prof.key);
  }
  const def = PARTS[c.type];
  if (!def) return [];
  if (def.breadboard) {
    const key = 'bb:' + def.breadboard;
    if (!termCache.has(key)) termCache.set(key, breadboardTerminals(def.breadboard));
    return termCache.get(key);
  }
  if (typeof def.pins === 'function')
    return def.pins(c).map(([id, x, y, z, info]) => ({id, label: id, p: [x, y, z], info: info ?? id}));
  if (!termCache.has(c.type))
    termCache.set(
      c.type,
      def.pins.map(([id, x, y, z, info]) => ({
        id,
        label: id,
        p: [x, y, z],
        info: info ? `${id} · ${info}` : id,
      }))
    );
  return termCache.get(c.type);
}

export const ref = (c, p) => `${typeof c === 'string' ? c : c.id}:${p}`;

export const makeComponent = (type, pos = [0, 0, 0], id = crypto.randomUUID()) => ({
  id,
  type,
  name: TYPES[type].name,
  position: pos,
  rotation: [0, 0, 0],
  params: structuredClone(TYPES[type].params),
});
