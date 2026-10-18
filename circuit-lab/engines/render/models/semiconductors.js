import {BJT_MODELS, MOS_MODELS} from '../../catalog/device-models.js';
import {cyl, mat, text, box} from '../geo.js';
import {roundLead, to92, to220, dipIC, INK} from './kit.js';

export const semiconductorsModels = {
  diode(g, c) {
    const m = c.params.model ?? '1N4007',
      glass = /4148|Zener/.test(m);
    for (const s of [-1, 1])
      roundLead(g, [
        [s * 5.08, 1, 0],
        [s * 5.08, 2, 0],
        [s * 2.6, 2, 0],
      ]);
    const body = cyl(
      g,
      glass ? 0.95 : 1.35,
      glass ? 3.8 : 5.2,
      0,
      2,
      0,
      glass
        ? mat(/Zener/.test(m) ? '#e47b3a' : '#d65b2a', 0.05, 0.12, {
            transmission: 0.4,
            transparent: true,
            opacity: 0.85,
          })
        : mat('#1b1b1d', 0.05, 0.45),
      20
    );
    body.rotation.z = Math.PI / 2;
    const band = cyl(
      g,
      glass ? 0.97 : 1.37,
      0.8,
      glass ? 1.2 : 1.9,
      2,
      0,
      mat(glass ? '#121212' : '#cfd2d4', glass ? 0 : 0.6, 0.4),
      20
    );
    band.rotation.z = Math.PI / 2;
  },
  npn(g, c) {
    to92(g, c, BJT_MODELS[c.params.model]);
  },
  pnp(g, c) {
    to92(g, c, BJT_MODELS[c.params.model]);
  },
  mosfet(g, c) {
    const m = MOS_MODELS[c.params.model] ?? MOS_MODELS.IRLZ44N;
    if (m.pkg === 'TO-92') to92(g, c, m);
    else to220(g, c.params.model.replace(' (P)', ''));
  },
  pc817(g) {
    /* Sharp PC817 DIP-4: 4.6 × 6.5 × 3.5 */ dipIC(
      g,
      4,
      4.6,
      [
        ['PC817', 1.2, 0.7, 0.95],
        ['C 2131', 0.8, -1.05, 0.8],
      ],
      {w: 6.5, h: 3.5, rot: Math.PI / 2}
    );
  },
  bridge(g, c) {
    /* DB-1 package (DB107): 8.3 × 6.5 × 3.3, leads 5.08 × 7.62; KBP307 keeps this footprint and prints its own number */ const pn =
        (c.params.model ?? 'DB107').split(' ')[0],
      top = dipIC(g, 4, 8.3, [[pn, 1.2, 0, 0.75]], {w: 6.5, pitch: 5.08, notch: false, dot: false});
    for (const [x, z, l] of [
      [-2.54, 3.81, '+'],
      [2.54, 3.81, '~'],
      [2.54, -3.81, '~'],
      [-2.54, -3.81, '−'],
    ])
      text(g, l, x, top + 0.02, z * 0.6, 1.6, 1.6, INK, 36, 0, 700, 'sans-serif');
    const bevel = box(g, 1.2, 0.2, 1.2, -4.15, top - 0.05, 3.25, mat('#0b0b0d', 0.05, 0.7));
    bevel.rotation.y = Math.PI / 4;
  },
};
