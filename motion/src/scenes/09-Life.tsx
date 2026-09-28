// 09 — 8-bit pixel. Conway's Game of Life: a glider gun and an R-pentomino, four rules, endless complexity.
import React, {useEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

const W = 96;
const H = 54;
const CELL = 20;
const FRAMES_PER_GEN = 2;
const GENS = 240;

const GUN = [
  [24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2], [11, 3], [15, 3], [20, 3], [21, 3],
  [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4], [0, 5], [1, 5], [10, 5], [14, 5], [16, 5],
  [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8],
];
const R_PENTOMINO = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]];
const ACORN = [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]];

type Gen = {age: Uint8Array; ghost: Uint8Array};

const simulate = (): Gen[] => {
  let alive = new Uint8Array(W * H);
  let age = new Uint8Array(W * H);
  let ghost = new Uint8Array(W * H);
  const place = (pattern: number[][], ox: number, oy: number) => {
    for (const [x, y] of pattern) {
      alive[(oy + y) * W + ox + x] = 1;
      age[(oy + y) * W + ox + x] = 1;
    }
  };
  place(GUN, 3, 3);
  place(R_PENTOMINO, 66, 30);
  place(ACORN, 30, 40);

  const gens: Gen[] = [{age: age.slice(), ghost: ghost.slice()}];
  for (let g = 1; g < GENS; g++) {
    const nextAlive = new Uint8Array(W * H);
    const nextAge = new Uint8Array(W * H);
    const nextGhost = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            n += alive[((y + dy + H) % H) * W + ((x + dx + W) % W)];
          }
        const i = y * W + x;
        const live = alive[i] ? n === 2 || n === 3 : n === 3;
        nextAlive[i] = live ? 1 : 0;
        nextAge[i] = live ? Math.min(255, age[i] + 1) : 0;
        nextGhost[i] = !live && alive[i] ? 5 : Math.max(0, ghost[i] - 1);
      }
    }
    alive = nextAlive;
    age = nextAge;
    ghost = nextGhost;
    gens.push({age: age.slice(), ghost: ghost.slice()});
  }
  return gens;
};

const RULES = [
  {en: '< 2 NEIGHBOURS → DIES', at: 40},
  {en: '2 OR 3 → LIVES ON', at: 90},
  {en: '> 3 → DIES', at: 140},
  {en: 'EXACTLY 3 → BORN', at: 190},
];

export const Life: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const gens = useMemo(simulate, []);
  const g = Math.min(GENS - 1, Math.floor(frame / FRAMES_PER_GEN));
  const population = useMemo(() => gens.map((x) => x.age.reduce((s, v) => s + (v ? 1 : 0), 0)), [gens]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#1b1829';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ctx.fillRect(x * CELL + 9, y * CELL + 9, 2, 2);
    const {age, ghost} = gens[g];
    for (let i = 0; i < W * H; i++) {
      const x = (i % W) * CELL;
      const y = Math.floor(i / W) * CELL;
      if (age[i]) {
        const a = age[i];
        ctx.fillStyle = a === 1 ? '#fbffb0' : a < 4 ? '#b6ff3b' : a < 12 ? '#2ee6a6' : a < 40 ? '#2aa7ff' : '#8b5cff';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      } else if (ghost[i]) {
        ctx.fillStyle = `rgba(255, 60, 140, ${ghost[i] / 24})`;
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }, [g, gens]);

  const endCard = spring({frame: frame - 330, fps, config: {damping: 13}});
  const outro = interpolate(frame, [425, 450], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: '#12101c', opacity: outro}}>
      <canvas ref={canvas} width={1920} height={1080} style={{position: 'absolute', imageRendering: 'pixelated'}} />

      <div style={{position: 'absolute', top: 40, right: 50, fontFamily: F.pixel, fontSize: 22, color: '#fbffb0', textAlign: 'right', lineHeight: 1.9, textShadow: '4px 4px 0 #000'}}>
        <div>09 · CONWAY 1970</div>
        <div>GEN {String(g).padStart(4, '0')}</div>
        <div style={{color: '#2ee6a6'}}>POP {String(population[g]).padStart(4, '0')}</div>
      </div>

      <div style={{position: 'absolute', left: 50, bottom: 50, display: 'flex', flexDirection: 'column', gap: 16}}>
        {RULES.map((r, i) => {
          const s = spring({frame: frame - r.at, fps, config: {damping: 200}});
          const off = interpolate(frame, [310, 325], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div
              key={r.en}
              style={{
                fontFamily: F.pixel,
                fontSize: 26,
                color: '#12101c',
                background: ['#fbffb0', '#b6ff3b', '#2ee6a6', '#2aa7ff'][i],
                padding: '14px 20px',
                boxShadow: '6px 6px 0 #000',
                width: 'fit-content',
                transform: `translateX(${(1 - s) * -700 - off * 900}px)`,
              }}
            >
              {i + 1}. {r.en}
            </div>
          );
        })}
      </div>

      {frame >= 320 && (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <div
            style={{
              background: '#12101c',
              border: '6px solid #fbffb0',
              boxShadow: '14px 14px 0 #8b5cff',
              padding: '50px 70px',
              textAlign: 'center',
              transform: `scale(${endCard})`,
            }}
          >
            <div style={{fontFamily: F.pixel, fontSize: 60, color: '#fbffb0', lineHeight: 1.5}}>4 RULES.</div>
            <div style={{fontFamily: F.pixel, fontSize: 60, color: '#2ee6a6', lineHeight: 1.5}}>ENDLESS WORLDS.</div>
            <div style={{fontFamily: F.kufi, fontWeight: 700, fontSize: 54, color: '#fff', marginTop: 20, direction: 'rtl'}}>
              أربع قواعد. عوالم لا نهائية.
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
