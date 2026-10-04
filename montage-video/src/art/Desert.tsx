import React from 'react';
import {Canvas, rnd, useBlur, useIds} from './util';

type Variant = 'golden' | 'sunset' | 'night';

const PAL: Record<Variant, Record<string, string>> = {
  golden: {sky0: '#F2A65A', sky1: '#FBD9A0', sky2: '#FDEBC8', sun: '#FFF7E6', glow: '#FFE9B8', far: '#EDB27A', mid: '#DC9658', midS: '#C47C42', near: '#CF8443', nearS: '#A9622F', rip: '#E6A266', fig: '#FBF8F1', figS: '#D8CDBB', shadow: '#8E4F25'},
  sunset: {sky0: '#2E1B48', sky1: '#B84C6B', sky2: '#FFB067', sun: '#FFE3AE', glow: '#FFC27D', far: '#B9614A', mid: '#8F4637', midS: '#73352C', near: '#6B2F2A', nearS: '#4D201F', rip: '#82413A', fig: '#F7E9DD', figS: '#C9A99A', shadow: '#2A1214'},
  night: {sky0: '#070B24', sky1: '#18214C', sky2: '#2E3A70', sun: '#F3F1E6', glow: '#7C8BD0', far: '#262C57', mid: '#1C2147', midS: '#151937', near: '#14183A', nearS: '#0D102A', rip: '#232A57', fig: '#E9ECF5', figS: '#9CA5C8', shadow: '#05071A'},
};

const FAR = 'M-420 650 C 0 600, 300 612, 600 640 S 1100 588, 1400 624 S 1900 598, 2340 632 V1080 H-420Z';
const MID = 'M-420 790 C -120 735, 260 700, 580 742 S 1180 830, 1520 772 S 2020 712, 2340 752 V1080 H-420Z';
const MID_SHADE = 'M580 742 S 1180 830, 1520 772 S 2020 712, 2340 752 V1080 H1180 C 1000 960, 800 860, 580 742Z';
const NEAR = 'M-420 950 C 80 860, 520 868, 880 912 S 1540 1000, 2340 930 V1080 H-420Z';

/** Layered dunes with a walking figure. `pan` moves the camera (parallax); `focus` blurs all but the figure. */
export const Desert: React.FC<{t: number; variant?: Variant; figure?: boolean; pan?: number; focus?: number}> = ({t, variant = 'golden', figure = true, pan = 0, focus = 0}) => {
  const p = PAL[variant];
  const ids = useIds('sky', 'sun', 'near', 'haze');
  const [bBackDef, bBack] = useBlur(focus * 14);
  const [bMidDef, bMid] = useBlur(focus * 4);
  const [bNearDef, bNear] = useBlur(focus * 9);
  const sunX = variant === 'sunset' ? 960 : 1380;
  const sunY = variant === 'sunset' ? 600 : variant === 'night' ? 230 : 330;
  const sunR = variant === 'sunset' ? 120 : 70;
  const walk = Math.sin(t * 5.5);
  const fx = 1010 + pan * 0.6;
  const fy = 800;
  return (
    <Canvas>
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky0} />
          <stop offset=".55" stopColor={p.sky1} />
          <stop offset="1" stopColor={p.sky2} />
        </linearGradient>
        <radialGradient id={ids.sun}>
          <stop offset="0" stopColor={p.glow} stopOpacity=".95" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.near} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.near} />
          <stop offset="1" stopColor={p.nearS} />
        </linearGradient>
        <linearGradient id={ids.haze} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky2} stopOpacity="0" />
          <stop offset="1" stopColor={p.sky2} stopOpacity=".55" />
        </linearGradient>
        {bBackDef}
        {bMidDef}
        {bNearDef}
      </defs>
      <g filter={bBack}>
        <rect x={-20} y={-20} width={1960} height={1120} fill={`url(#${ids.sky})`} />
        {variant === 'night' &&
          Array.from({length: 120}, (_, i) => (
            <circle key={i} cx={rnd(i) * 1920} cy={rnd(i + 300) * 560} r={rnd(i + 600) * 1.8 + 0.4} fill="#fff" opacity={0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i))} />
          ))}
        <circle cx={sunX + pan * 0.1} cy={sunY} r={sunR * 6} fill={`url(#${ids.sun})`} />
        <circle cx={sunX + pan * 0.1} cy={sunY} r={sunR} fill={p.sun} />
        <path d={FAR} fill={p.far} transform={`translate(${pan * 0.25} 0)`} />
        <rect x={-20} y={420} width={1960} height={260} fill={`url(#${ids.haze})`} />
      </g>
      <g filter={bMid} transform={`translate(${pan * 0.6} 0)`}>
        <path d={MID} fill={p.mid} />
        <path d={MID_SHADE} fill={p.midS} opacity={0.75} />
        {/* footprints climbing to the figure */}
        {figure &&
          Array.from({length: 9}, (_, i) => {
            const k = i / 8;
            const x = 640 + k * 350 + (i % 2 ? 9 : -9);
            const y = 900 - k * 98;
            return <ellipse key={i} cx={x} cy={y} rx={13 - k * 5} ry={5.5 - k * 2} fill={p.midS} opacity={0.95} />;
          })}
      </g>
      {figure && (
        <g transform={`translate(${fx} ${fy}) scale(1.9)`}>
          {/* long low-sun shadow */}
          <path d="M -14 0 L 120 6 L 118 -2 L -10 -6 Z" fill={p.shadow} opacity={0.3} />
          {/* feet */}
          <ellipse cx={-6 + walk * 5} cy={-2} rx={6} ry={3} fill="#5A3E2B" />
          <ellipse cx={6 - walk * 5} cy={-2} rx={6} ry={3} fill="#5A3E2B" />
          {/* thobe, seen from behind; light from the right */}
          <path d="M -17 -90 C -21 -60, -24 -32, -23 -6 L 23 -6 C 24 -32, 21 -60, 17 -90 Z" fill={p.fig} />
          <path d="M -17 -90 C -21 -60, -24 -32, -23 -6 L -9 -6 C -10 -40, -9 -66, -6 -90 Z" fill={p.figS} />
          <path d="M 2 -78 C 3 -55, 4 -30, 4 -8" stroke={p.figS} strokeWidth={1.4} fill="none" opacity={0.7} />
          <path d="M 12 -70 C 14 -48, 15 -28, 15 -8" stroke={p.figS} strokeWidth={1.2} fill="none" opacity={0.5} />
          {/* sleeves + hands, swinging */}
          <g transform={`rotate(${walk * 10} -18 -86)`}>
            <path d="M -18 -88 C -24 -74, -26 -60, -25 -50 L -17 -50 C -16 -62, -14 -76, -12 -86 Z" fill={p.figS} />
            <circle cx={-21} cy={-47} r={3.6} fill="#B98A64" />
          </g>
          <g transform={`rotate(${-walk * 10} 18 -86)`}>
            <path d="M 18 -88 C 24 -74, 26 -60, 25 -50 L 17 -50 C 16 -62, 14 -76, 12 -86 Z" fill={p.fig} />
            <circle cx={21} cy={-47} r={3.6} fill="#C99A72" />
          </g>
          {/* shemagh draped over head and shoulders, with the black agal on top */}
          <path d="M -13 -104 C -14 -122, 14 -122, 13 -104 L 20 -82 C 12 -76, 4 -70, 0 -66 C -4 -70, -12 -76, -20 -82 Z" fill="#FFFFFF" />
          <path d="M -13 -104 L -20 -82 C -12 -76, -4 -70, 0 -66 L -2 -104 Z" fill={p.figS} opacity={0.75} />
          <ellipse cx={0} cy={-113} rx={11.5} ry={3.2} fill="none" stroke="#1B1B1E" strokeWidth={2.6} />
          <ellipse cx={0} cy={-109.5} rx={12.5} ry={3.4} fill="none" stroke="#1B1B1E" strokeWidth={2.6} />
        </g>
      )}
      <g filter={bNear} transform={`translate(${pan} 0)`}>
        <path d={NEAR} fill={`url(#${ids.near})`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M ${-300 + i * 90} ${985 + i * 22} C ${300 + i * 60} ${950 + i * 20}, ${900 + i * 40} ${1010 + i * 18}, ${2300} ${960 + i * 24}`} stroke={p.rip} strokeWidth={3} fill="none" opacity={0.45} />
        ))}
      </g>
    </Canvas>
  );
};
