// Canvas-textured screens: character LCD, OLED and the instruments’ readouts.
// Each updater gets the model's userData, the part's simulated state, the component and a context
// whose set() changes a material value only when it moved (and marks the frame dirty).
import {drawGfx, lcdFace} from '../displays.js';

// Each screen returns a key (what it shows) and draw(ctx) for its canvas; it is redrawn only when the key changes.
function characterScreen(d, c, comp, state) {
  let key, draw;

  const s = c?.powered ? (state.oled?.[comp.id] ?? '') : '',
    gx = state.gfx?.[comp.id];
  key = JSON.stringify([s, c?.powered, gx]);
  draw = ctx => {
    if (d.lcd) {
      const lit = c?.powered && gx?.backlight !== false;
      ctx.fillStyle = c?.powered ? (lit ? '#a4b85d' : '#7d8a4c') : '#65724d';
      ctx.fillRect(0, 0, d.canvas.width, d.canvas.height);
      ctx.fillStyle = '#243824';
      ctx.font = '42px monospace';
      s.split('\n')
        .slice(0, 2)
        .forEach((l, i) => ctx.fillText(l, 7, 48 + i * 57));
    } else if (gx?.cmds && c?.powered) drawGfx(ctx, gx, d.canvas.width, d.canvas.height);
    else {
      ctx.fillStyle = '#071415';
      ctx.fillRect(0, 0, d.canvas.width, d.canvas.height);
      ctx.fillStyle = '#9ce7df';
      ctx.font = '18px monospace';
      s.split('\n')
        .slice(0, 6)
        .forEach((l, i) => ctx.fillText(l, 7, 20 + i * 20));
    }
  };

  return {key, draw};
}

function panelMeter(d, c, comp, state) {
  let key, draw;

  key = c?.display ?? '';
  draw = ctx =>
    lcdFace(
      ctx,
      d.canvas.width,
      d.canvas.height,
      '#140405',
      '#ff3b2b',
      [c?.display ?? ''],
      'bold 104px monospace'
    );

  return {key, draw};
}

function pwmGenerator(d, c, comp, state) {
  let key, draw;

  const p = comp.params,
    f =
      p.frequency >= 1000
        ? `F${(p.frequency / 1000).toFixed(p.frequency >= 10000 ? 1 : 2)}k`
        : `F${String(Math.round(p.frequency)).padStart(3, '0')}`;
  key = JSON.stringify([f, p.duty, c?.powered]);
  draw = ctx =>
    lcdFace(
      ctx,
      d.canvas.width,
      d.canvas.height,
      c?.powered ? '#2c5fd0' : '#1b2433',
      '#e9f2ff',
      c?.powered ? [f, `D${String(Math.round(p.duty * 100)).padStart(3, '0')}`] : ['', ''],
      'bold 48px monospace'
    );

  return {key, draw};
}

function acSource(d, c, comp, state) {
  let key, draw;

  const p = comp.params;
  key = JSON.stringify([p.vrms, p.frequency, p.on]);
  draw = ctx =>
    lcdFace(
      ctx,
      d.canvas.width,
      d.canvas.height,
      '#160a04',
      '#ffb03a',
      p.on ? [`${p.vrms.toFixed(1)} V~`, `${p.frequency} Hz`] : ['OFF', ''],
      'bold 36px monospace'
    );

  return {key, draw};
}

function multimeter(d, c, comp, state) {
  let key, draw;

  key = c?.display ?? '';
  draw = ctx =>
    lcdFace(
      ctx,
      d.canvas.width,
      d.canvas.height,
      '#a9b39a',
      '#1c221a',
      [` ${c?.display ?? '0.000'}`],
      'bold 56px monospace'
    );

  return {key, draw};
}

function benchSupply(d, c, comp, state) {
  let key, draw;

  key = JSON.stringify([c?.voltage?.toFixed(2), c?.current?.toFixed(3), c?.mode]);
  draw = ctx =>
    lcdFace(
      ctx,
      d.canvas.width,
      d.canvas.height,
      '#061a10',
      '#5dff9a',
      [
        `${(c?.voltage ?? 0).toFixed(2).padStart(5, '0')} V`,
        `${(c?.current ?? 0).toFixed(3)} A  ${(c?.mode ?? '').slice(0, 2)}`,
      ],
      'bold 34px monospace'
    );

  return {key, draw};
}

function functionGenerator(d, c, comp, state) {
  let key, draw;

  const p = comp.params;
  key = JSON.stringify(p);
  draw = ctx => {
    lcdFace(
      ctx,
      d.canvas.width,
      d.canvas.height,
      '#04121c',
      '#6fd2ff',
      [
        `${p.wave.toUpperCase()}  ${p.frequency} Hz`,
        `${p.amplitude} Vp  ${p.offset >= 0 ? '+' : ''}${p.offset} V`,
      ],
      'bold 26px monospace'
    );
  };

  return {key, draw};
}

function oscilloscope(d, c, comp, state) {
  let key, draw;

  const sc = state.scope?.[comp.id];
  key = sc ? sc.t.length + ':' + sc.t[sc.t.length - 1] : 'none';
  draw = ctx => {
    const W = d.canvas.width,
      H = d.canvas.height;
    ctx.fillStyle = '#050807';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1d3a2c';
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((i * W) / 10, 0);
      ctx.lineTo((i * W) / 10, H);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * H) / 8);
      ctx.lineTo(W, (i * H) / 8);
      ctx.stroke();
    }
    if (!sc) return;
    const n = sc.t.length,
      max = Math.max(1, ...sc.v.flat().map(Math.abs));
    ['#f2d235', '#3ac0e8'].forEach((col, ch) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      sc.v.forEach((v, i) => {
        const x = (i / (n - 1 || 1)) * W,
          y = H / 2 - (v[ch] / max) * H * 0.45;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  };

  return {key, draw};
}

const SCREENS = {
  oled: characterScreen,
  lcd: characterScreen,
  panelmeter: panelMeter,
  pwmgen: pwmGenerator,
  acsource: acSource,
  multimeter: multimeter,
  psu: benchSupply,
  fgen: functionGenerator,
  scope: oscilloscope,
};

export function display(ud, c, comp, frame) {
  const d = ud.display,
    screen = SCREENS[comp.type]?.(d, c, comp, frame.state);
  if (screen?.draw && d.last !== screen.key) {
    screen.draw(d.canvas.getContext('2d'));
    d.texture.needsUpdate = true;
    d.last = screen.key;
    frame.changed = true;
  }
}
