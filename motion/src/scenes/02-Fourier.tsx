// 02 — Deep-space neon. A chain of rotating circles (a Fourier series) draws the symbol π.
import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {F} from '../fonts';

type P = [number, number];
type Term = {freq: number; amp: number; phase: number};

// Blocky π outline, clockwise, in abstract units.
const PI_OUTLINE: P[] = [
  [-3.4, 2.4], [-2.6, 3.1], [3.4, 3.1], [3.4, 2.0], [1.7, 2.0], [1.7, -1.9], [1.9, -2.4], [2.6, -2.5],
  [3.0, -2.2], [3.2, -2.8], [2.4, -3.4], [1.1, -3.3], [0.6, -2.6], [0.5, 2.0], [-0.8, 2.0], [-1.1, -1.4],
  [-1.6, -2.9], [-2.3, -3.4], [-3.0, -3.0], [-2.6, -2.3], [-2.2, -0.9], [-1.9, 2.0], [-2.6, 2.0], [-3.4, 2.4],
];

const resample = (poly: P[], n: number): P[] => {
  const seg = poly.slice(0, -1).map((p, i) => Math.hypot(poly[i + 1][0] - p[0], poly[i + 1][1] - p[1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: P[] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total;
    let i = 0;
    while (d > seg[i]) d -= seg[i++];
    const t = d / seg[i];
    out.push([poly[i][0] + (poly[i + 1][0] - poly[i][0]) * t, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * t]);
  }
  return out;
};

const dft = (pts: P[]): Term[] => {
  const N = pts.length;
  const terms: Term[] = [];
  for (let k = -N / 2; k < N / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N;
      re += pts[n][0] * Math.cos(a) - pts[n][1] * Math.sin(a);
      im += pts[n][0] * Math.sin(a) + pts[n][1] * Math.cos(a);
    }
    re /= N;
    im /= N;
    terms.push({freq: k, amp: Math.hypot(re, im), phase: Math.atan2(im, re)});
  }
  return terms.sort((a, b) => b.amp - a.amp);
};

const SCALE = 118;
const OX = 1240;
const OY = 540;
const K = 80; // circles used
const DRAW_START = 40;
const DRAW_END = 480;

const evalChain = (terms: Term[], t: number) => {
  let x = 0;
  let y = 0;
  const joints: {x: number; y: number; r: number}[] = [];
  for (const term of terms) {
    joints.push({x, y, r: term.amp});
    const a = 2 * Math.PI * term.freq * t + term.phase;
    x += term.amp * Math.cos(a);
    y += term.amp * Math.sin(a);
  }
  return {x, y, joints};
};

const toScreen = (x: number, y: number): P => [OX + x * SCALE, OY - y * SCALE];

export const Fourier: React.FC = () => {
  const frame = useCurrentFrame();
  const terms = useMemo(() => dft(resample(PI_OUTLINE, 256)).slice(0, K), []);
  const curve = useMemo(() => {
    const out: P[] = [];
    for (let i = 0; i <= 900; i++) {
      const {x, y} = evalChain(terms, i / 900);
      out.push(toScreen(x, y));
    }
    return out;
  }, [terms]);

  const t = interpolate(frame, [DRAW_START, DRAW_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  const chain = evalChain(terms, t);
  const shown = curve.slice(0, Math.max(2, Math.round(t * 900) + 1));
  const d = 'M' + shown.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
  const tip = toScreen(chain.x, chain.y);

  const chainFade = interpolate(frame, [DRAW_END, DRAW_END + 30], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fill = interpolate(frame, [DRAW_END + 10, DRAW_END + 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const intro = interpolate(frame, [0, 30], [0, 1], {extrapolateRight: 'clamp'});
  const outro = interpolate(frame, [570, 600], [1, 0], {extrapolateLeft: 'clamp'});

  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 65% 50%, #0d1030 0%, #04050d 70%)', opacity: outro}}>
      {/* star dust */}
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {Array.from({length: 140}).map((_, i) => {
          const x = (i * 7919) % 1920;
          const y = (i * 104729) % 1080;
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(frame / 20 + i));
          return <circle key={i} cx={x} cy={y} r={(i % 3) * 0.6 + 0.6} fill="#9fb4ff" opacity={tw * 0.5 * intro} />;
        })}
      </svg>

      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="100%" stopColor="#ff2bd6" />
          </linearGradient>
        </defs>

        <g opacity={chainFade * intro}>
          {chain.joints.map((j, i) => {
            const [sx, sy] = toScreen(j.x, j.y);
            const next = i + 1 < chain.joints.length ? chain.joints[i + 1] : {x: chain.x, y: chain.y};
            const [nx, ny] = toScreen(next.x, next.y);
            const o = Math.max(0.08, 0.55 - i * 0.012);
            return (
              <g key={i}>
                <circle cx={sx} cy={sy} r={j.r * SCALE} fill="none" stroke="#7d8cff" strokeWidth={1.2} opacity={o} />
                <line x1={sx} y1={sy} x2={nx} y2={ny} stroke="#e8ecff" strokeWidth={1.5} opacity={o + 0.2} />
              </g>
            );
          })}
        </g>

        <path d={d + (fill > 0 ? 'Z' : '')} fill="url(#ink)" fillOpacity={fill * 0.18} stroke="url(#ink)" strokeWidth={5} filter="url(#glow)" strokeLinejoin="round" />
        {chainFade > 0 && <circle cx={tip[0]} cy={tip[1]} r={9} fill="#fff" filter="url(#glow)" opacity={chainFade} />}
      </svg>

      {/* copy */}
      <div style={{position: 'absolute', left: 110, top: 150, width: 560, color: '#e8ecff', opacity: intro}}>
        <div style={{fontFamily: F.mono, fontSize: 22, letterSpacing: 6, color: '#00f0ff'}}>02 / FOURIER SERIES</div>
        <div style={{fontFamily: F.grotesk, fontWeight: 700, fontSize: 84, lineHeight: 1.02, marginTop: 30}}>
          Every shape
          <br />
          is a sum of
          <br />
          <span style={{color: '#ff2bd6'}}>circles.</span>
        </div>
        <div style={{fontFamily: F.cairo, fontWeight: 700, fontSize: 46, marginTop: 40, direction: 'rtl', textAlign: 'right', color: '#b7c1ff'}}>
          كل شكل هو مجموع دوائر
        </div>
        <div style={{fontFamily: F.mono, fontSize: 24, marginTop: 60, color: '#7d8cff', lineHeight: 1.7}}>
          f(t) = Σ c<sub>n</sub>·e<sup>i2πnt</sup>
          <br />
          circles: {K}
          <br />
          t = {t.toFixed(3)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
