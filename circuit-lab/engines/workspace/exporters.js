import {isBoard, profileOf} from '../catalog/boards.js';
import {DIODE_MODELS, BJT_MODELS, MOS_MODELS} from '../catalog/device-models.js';
import {TYPES, ref, isBreadboard} from '../catalog/types.js';
import {Circuit} from '../circuit/circuit.js';

export const csv = v => `"${String(v).replace(/"/g, '""')}"`;

export const valueOf = c => {
  const p = c.params;
  switch (c.type) {
    case 'resistor':
      return `${p.resistance} Ω`;
    case 'capacitor':
    case 'electrolytic':
      return `${+(p.capacitance * 1e6).toPrecision(4)} µF${p.rating ? ` ${p.rating} V` : ''}`;
    case 'inductor':
      return `${+(p.inductance * 1e3).toPrecision(4)} mH`;
    case 'diode':
    case 'npn':
    case 'pnp':
    case 'mosfet':
    case 'regulator':
      return p.model;
    case 'led':
      return `${p.color} · Vf ${p.vf} V`;
    case 'battery':
      return `${p.voltage} V`;
    case 'aapack':
      return `${p.cells} × AA`;
    case 'pot':
      return `${p.resistance} Ω`;
    default:
      return isBoard(c) ? profileOf(c).mcu : (TYPES[c.type].spec ?? '');
  }
};

export function bomCsv(project) {
  const groups = new Map();
  for (const c of project.components) {
    const key = [TYPES[c.type].name, valueOf(c)].join('|');
    const g = groups.get(key) ?? {
      part: TYPES[c.type].name,
      value: valueOf(c),
      category: TYPES[c.type].category,
      refs: [],
    };
    g.refs.push(c.name === TYPES[c.type].name ? c.id.slice(0, 8) : c.name);
    groups.set(key, g);
  }
  const wires = project.wires.filter(w => w.kind !== 'contact').length;
  return [
    'Qty,Part,Value / model,Category,References',
    ...[...groups.values()]
      .sort((a, b) => a.category.localeCompare(b.category))
      .map(g => [g.refs.length, g.part, g.value, g.category, g.refs.join(' ')].map(csv).join(',')),
    [wires, 'Jumper wire (Dupont)', '', 'Prototyping', ''].map(csv).join(','),
  ].join('\n');
}

export function spiceNetlist(project) {
  const c = new Circuit(project),
    idx = c.graph.index;
  const gnd = (() => {
    for (const x of project.components) {
      if (isBoard(x)) return idx[ref(x, profileOf(x).gnd[0])];
      if (['battery', 'aapack', 'lipo', 'psu'].includes(x.type)) return idx[ref(x, '-')];
      if (['fgen', 'scope'].includes(x.type)) return idx[ref(x, 'GND')];
    }
  })();
  const node = (x, p) => {
    const i = idx[ref(x, p)];
    return i === undefined ? 'NC_' + x.id.slice(0, 4) + '_' + p : i === gnd ? '0' : 'N' + i;
  };
  const out = [
      `* ${project.name} — exported by Circuit Lab`,
      `* Nodes are electrical nets solved by the Lab; microcontroller boards are firmware-driven and are listed as comments.`,
    ],
    models = new Set();
  let n = 0;
  const id = (p, x) => `${p}${++n}_${x.name.replace(/\W+/g, '').slice(0, 10)}`;
  for (const x of project.components) {
    const p = x.params,
      N = pin => node(x, pin);
    switch (x.type) {
      case 'resistor':
        out.push(`${id('R', x)} ${N('A')} ${N('B')} ${p.resistance}`);
        break;
      case 'pot':
        out.push(
          `${id('R', x)} ${N('VCC')} ${N('W')} ${Math.max(1, p.resistance * (1 - p.value))}`,
          `${id('R', x)} ${N('W')} ${N('GND')} ${Math.max(1, p.resistance * p.value)}`
        );
        break;
      case 'capacitor':
        out.push(`${id('C', x)} ${N('A')} ${N('B')} ${p.capacitance}`);
        break;
      case 'electrolytic':
        out.push(`${id('C', x)} ${N('+')} ${N('-')} ${p.capacitance}`);
        break;
      case 'inductor':
        out.push(`${id('L', x)} ${N('A')} ${N('B')} ${p.inductance} Rser=${p.dcr}`);
        break;
      case 'diode': {
        const m = DIODE_MODELS[p.model],
          name = p.model.split(' ')[0].replace(/\W/g, '');
        models.add(
          `.model ${name} D(IS=${m.is} N=${m.n} RS=${m.rs}${m.bv ? ` BV=${m.bv} IBV=${m.izt}` : ''})`
        );
        out.push(`${id('D', x)} ${N('A')} ${N('K')} ${name}`);
        break;
      }
      case 'led':
        models.add(`.model LED_${(x.params.vf * 10) | 0} D(IS=1e-20 N=1.8 RS=15)`);
        out.push(`${id('D', x)} ${N('A')} ${N('K')} LED_${(x.params.vf * 10) | 0}`);
        break;
      case 'npn':
      case 'pnp': {
        const m = BJT_MODELS[p.model];
        models.add(`.model ${p.model} ${m.npn ? 'NPN' : 'PNP'}(IS=${m.is} BF=${m.bf} BR=${m.br})`);
        out.push(`${id('Q', x)} ${N('C')} ${N('B')} ${N('E')} ${p.model}`);
        break;
      }
      case 'mosfet': {
        const m = MOS_MODELS[p.model],
          name = p.model.replace(/\W/g, '');
        models.add(
          `.model ${name} ${m.p ? 'PMOS' : 'NMOS'}(LEVEL=1 VTO=${m.vth} KP=${2 * m.k} LAMBDA=${m.lambda})`
        );
        out.push(`${id('M', x)} ${N('D')} ${N('G')} ${N('S')} ${N('S')} ${name}`);
        break;
      }
      case 'battery':
        out.push(`${id('V', x)} ${N('+')} ${N('-')} DC ${p.voltage} Rser=${p.internalResistance}`);
        break;
      case 'aapack':
        out.push(`${id('V', x)} ${N('+')} ${N('-')} DC ${p.cells * 1.5} Rser=${0.15 * p.cells}`);
        break;
      case 'psu':
        out.push(`${id('V', x)} ${N('+')} ${N('-')} DC ${p.voltage} Rser=0.01`);
        break;
      case 'fgen':
        out.push(
          `${id('V', x)} ${N('OUT')} ${N('GND')} ${p.wave === 'sine' ? `SIN(${p.offset} ${p.amplitude} ${p.frequency})` : `PULSE(${p.offset - p.amplitude} ${p.offset + p.amplitude} 0 1u 1u ${0.5 / p.frequency} ${1 / p.frequency})`} Rser=50`
        );
        break;
      default:
        if (isBoard(x)) out.push(`* ${x.name}: ${profileOf(x).name} (${profileOf(x).mcu})`);
        else if (!isBreadboard(x))
          out.push(`* ${x.name} (${TYPES[x.type].name}) is a behavioural Lab model and is not exported`);
    }
  }
  return [...out, ...models, '.tran 1m 1', '.end'].join('\n');
}

export function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], {type}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
