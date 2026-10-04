import React from 'react';
import {F} from '../fonts';
import {Canvas, rnd, useIds} from './util';

const INK = '#3E3428';

/** Early-industrial factory silhouette with drifting smoke. */
export const Factory: React.FC<{t: number}> = ({t}) => {
  const ids = useIds('sky');
  return (
    <Canvas>
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D8CBB0" />
          <stop offset="1" stopColor="#EDE3CF" />
        </linearGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.sky})`} />
      {/* smoke */}
      {[520, 700, 1420].map((cx, c) =>
        Array.from({length: 7}, (_, i) => {
          const k = ((i / 7 + t * 0.08 + c * 0.13) % 1);
          return <circle key={`${c}-${i}`} cx={cx + k * 260} cy={250 - k * 260} r={30 + k * 90} fill="#9A8D76" opacity={0.45 * (1 - k)} />;
        }),
      )}
      {/* chimneys */}
      {[
        [490, 230, 60],
        [670, 190, 70],
        [1395, 260, 56],
      ].map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={600} fill={INK} />
          <rect x={x - 6} y={y} width={w + 12} height={22} fill={INK} />
          <rect x={x} y={y + 80} width={w} height={10} fill="#5A4D3C" />
        </g>
      ))}
      {/* sawtooth hall */}
      <path d="M 260 560 L 380 470 L 380 560 L 500 470 L 500 560 L 620 470 L 620 560 L 740 470 L 740 560 L 860 470 L 860 560 L 980 470 L 980 560 L 980 860 L 260 860 Z" fill={INK} />
      {/* tall building + conveyor */}
      <rect x={1100} y={380} width={420} height={480} fill="#4A3F31" />
      <path d="M 980 760 L 1100 620 L 1130 640 L 1010 780 Z" fill={INK} />
      <path d="M 1520 470 L 1880 300 L 1900 330 L 1540 500 Z" fill={INK} />
      {Array.from({length: 9}, (_, i) => (
        <line key={i} x1={1540 + i * 40} y1={490 - i * 19} x2={1560 + i * 40} y2={860} stroke={INK} strokeWidth={4} />
      ))}
      {/* windows */}
      {Array.from({length: 6}, (_, r) =>
        Array.from({length: 7}, (_, c) => <rect key={`${r}-${c}`} x={1130 + c * 56} y={410 + r * 70} width={36} height={44} fill="#B8A887" opacity={rnd(r * 9 + c) > 0.3 ? 0.9 : 0.3} />),
      )}
      {Array.from({length: 10}, (_, c) => (
        <rect key={c} x={290 + c * 66} y={620} width={40} height={90} fill="#B8A887" opacity={0.75} />
      ))}
      <rect x={0} y={858} width={1920} height={222} fill="#6E6150" />
      {Array.from({length: 40}, (_, i) => (
        <line key={i} x1={i * 50} y1={858} x2={i * 50 - 30} y2={1080} stroke="#5D5141" strokeWidth={3} />
      ))}
    </Canvas>
  );
};

const gearPath = (teeth: number, r: number, depth: number) => {
  const pts: string[] = [];
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 4 < 2 ? r + depth : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
};

/** Interlocking gears with pipes behind. */
export const Gears: React.FC<{t: number; close?: boolean}> = ({t, close}) => {
  const ids = useIds('bg');
  const gears = [
    {x: 760, y: 560, teeth: 18, r: 250, c: '#A8977B', dir: 1},
    {x: 1190, y: 330, teeth: 12, r: 160, c: '#8B7C63', dir: -1.5},
    {x: 1250, y: 760, teeth: 10, r: 130, c: '#C2B192', dir: -1.8},
  ];
  return (
    <Canvas>
      <defs>
        <radialGradient id={ids.bg} cx=".5" cy=".5" r=".7">
          <stop offset="0" stopColor="#4A4136" />
          <stop offset="1" stopColor="#1E1A16" />
        </radialGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.bg})`} />
      <g transform={close ? 'translate(-260 -120) scale(1.3)' : undefined}>
        {[
          'M -50 180 C 400 180, 420 420, 900 420 S 1500 160, 1980 160',
          'M -50 900 C 300 900, 500 980, 1000 980 S 1600 860, 1980 900',
          'M 1600 -50 C 1600 300, 1700 500, 1700 1130',
        ].map((d, i) => (
          <g key={i}>
            <path d={d} stroke="#2E2820" strokeWidth={70} fill="none" strokeLinecap="round" />
            <path d={d} stroke="#5E5243" strokeWidth={46} fill="none" strokeLinecap="round" />
            <path d={d} stroke="#7A6C58" strokeWidth={8} fill="none" opacity={0.6} transform="translate(0 -12)" />
          </g>
        ))}
        {gears.map((g, i) => (
          <g key={i} transform={`translate(${g.x} ${g.y}) rotate(${(t * 22 * g.dir + i * 7) % 360})`}>
            <path d={gearPath(g.teeth, g.r, 34)} fill="#2E2820" transform="translate(10 14)" opacity={0.6} />
            <path d={gearPath(g.teeth, g.r, 34)} fill={g.c} />
            <circle r={g.r * 0.72} fill="none" stroke="#2E2820" strokeWidth={6} opacity={0.4} />
            {Array.from({length: 5}, (_, k) => (
              <circle key={k} cx={Math.cos((k / 5) * 6.283) * g.r * 0.48} cy={Math.sin((k / 5) * 6.283) * g.r * 0.48} r={g.r * 0.14} fill="#2B251E" />
            ))}
            <circle r={g.r * 0.2} fill="#2B251E" />
            <circle r={g.r * 0.09} fill={g.c} />
          </g>
        ))}
      </g>
    </Canvas>
  );
};

/** Antique map with invented coasts, a compass rose and Arabic labels. */
export const MapArt: React.FC<{t: number}> = () => {
  const ids = useIds('paper', 'edge');
  return (
    <Canvas>
      <defs>
        <radialGradient id={ids.paper} cx=".5" cy=".5" r=".75">
          <stop offset="0" stopColor="#EEDFBF" />
          <stop offset=".75" stopColor="#DCC598" />
          <stop offset="1" stopColor="#A98A5A" />
        </radialGradient>
      </defs>
      <rect width={1920} height={1080} fill={`url(#${ids.paper})`} />
      {Array.from({length: 13}, (_, i) => (
        <line key={`v${i}`} x1={i * 160} y1={0} x2={i * 160 + 40} y2={1080} stroke="#A48A62" strokeWidth={1.5} opacity={0.45} />
      ))}
      {Array.from({length: 8}, (_, i) => (
        <path key={`h${i}`} d={`M 0 ${i * 150} Q 960 ${i * 150 + 30}, 1920 ${i * 150}`} stroke="#A48A62" strokeWidth={1.5} fill="none" opacity={0.45} />
      ))}
      {[
        'M 1150 120 C 1300 90, 1500 140, 1620 230 C 1720 300, 1700 420, 1600 470 C 1520 510, 1480 600, 1380 610 C 1280 620, 1220 540, 1160 500 C 1080 450, 1020 380, 1040 290 C 1060 200, 1080 140, 1150 120 Z',
        'M 300 380 C 420 330, 560 360, 640 450 C 720 540, 700 650, 640 740 C 590 820, 520 900, 420 880 C 330 860, 300 760, 260 680 C 220 600, 200 430, 300 380 Z',
        'M 980 700 C 1080 660, 1200 700, 1240 780 C 1280 860, 1200 940, 1100 950 C 1000 960, 930 900, 920 820 C 910 760, 930 720, 980 700 Z',
      ].map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke="#8C7350" strokeWidth={14} opacity={0.18} />
          <path d={d} fill="#D2B988" stroke="#6F5937" strokeWidth={3} />
        </g>
      ))}
      <text x={820} y={560} fontFamily={F.amiri} fontSize={46} fill="#7A6242" fontStyle="italic" opacity={0.85}>بحر الظلمات</text>
      <text x={1380} y={380} fontFamily={F.amiri} fontSize={36} fill="#5E4A2E" textAnchor="middle">الجزيرة</text>
      <text x={460} y={640} fontFamily={F.amiri} fontSize={34} fill="#5E4A2E" textAnchor="middle">البرّ الغربي</text>
      <g transform="translate(250 220)">
        <circle r={110} fill="none" stroke="#6F5937" strokeWidth={3} />
        <circle r={80} fill="none" stroke="#6F5937" strokeWidth={1.5} />
        <path d="M 0 -130 L 18 0 L 0 130 L -18 0 Z" fill="#6F5937" />
        <path d="M -130 0 L 0 18 L 130 0 L 0 -18 Z" fill="#8C7350" />
        <text y={-142} textAnchor="middle" fontFamily={F.amiri} fontSize={34} fill="#5E4A2E">ش</text>
      </g>
    </Canvas>
  );
};
