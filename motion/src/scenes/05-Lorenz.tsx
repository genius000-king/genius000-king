// 05 — Dark scientific. Two Lorenz trajectories start 0.00001 apart and diverge: the butterfly effect.
import React, {useEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {F} from '../fonts';

type V3 = [number, number, number];
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const DT = 0.004;
const STEPS = 11000;

const deriv = ([x, y, z]: V3): V3 => [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];
const add = (a: V3, b: V3, s: number): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

const integrate = (start: V3): Float32Array => {
  const out = new Float32Array(STEPS * 3);
  let p = start;
  for (let i = 0; i < STEPS; i++) {
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
    const k1 = deriv(p);
    const k2 = deriv(add(p, k1, DT / 2));
    const k3 = deriv(add(p, k2, DT / 2));
    const k4 = deriv(add(p, k3, DT));
    p = [
      p[0] + (DT / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      p[1] + (DT / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      p[2] + (DT / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    ];
  }
  return out;
};

const TOTAL = 450;

export const Lorenz: React.FC = () => {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const a = useMemo(() => integrate([1, 1, 1]), []);
  const b = useMemo(() => integrate([1.00001, 1, 1]), []);

  const count = Math.floor(interpolate(frame, [15, 400], [2, STEPS], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const yaw = frame * 0.006 + 0.6;
  const pitch = 0.35;
  const idx = count - 1;
  const dist = Math.hypot(a[idx * 3] - b[idx * 3], a[idx * 3 + 1] - b[idx * 3 + 1], a[idx * 3 + 2] - b[idx * 3 + 2]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const proj = (arr: Float32Array, i: number): [number, number] => {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      const z = arr[i * 3 + 2] - 25;
      const x1 = x * cy - y * sy;
      const y1 = x * sy + y * cy;
      const z2 = z * cp - y1 * sp;
      return [1180 + x1 * 17, 560 - z2 * 17];
    };
    const draw = (arr: Float32Array, color: string) => {
      const CHUNK = 60;
      for (let s = 0; s < count - 1; s += CHUNK) {
        const e = Math.min(count - 1, s + CHUNK);
        const age = (count - s) / STEPS;
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.max(0.12, 0.9 - age * 1.4);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const [x0, y0] = proj(arr, s);
        ctx.moveTo(x0, y0);
        for (let i = s + 1; i <= e; i++) {
          const [x, y] = proj(arr, i);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const [hx, hy] = proj(arr, count - 1);
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, 26, 0, Math.PI * 2);
      ctx.fill();
    };
    draw(a, '#22d3ee');
    draw(b, '#ff7a1a');
  }, [a, b, count, yaw]);

  const intro = interpolate(frame, [0, 25], [0, 1], {extrapolateRight: 'clamp'});
  const outro = interpolate(frame, [TOTAL - 25, TOTAL], [1, 0], {extrapolateLeft: 'clamp'});
  const diverged = dist > 5;
  const tag = interpolate(frame, [300, 330], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 60% 50%, #0b1620, #020407 70%)', opacity: intro * outro}}>
      <canvas ref={canvas} width={1920} height={1080} style={{position: 'absolute'}} />

      <div style={{position: 'absolute', left: 110, top: 110, color: '#e6f1f5'}}>
        <div style={{fontFamily: F.mono, fontSize: 22, letterSpacing: 6, color: '#22d3ee'}}>05 / LORENZ SYSTEM</div>
        <div style={{fontFamily: F.grotesk, fontSize: 80, fontWeight: 700, lineHeight: 1.02, marginTop: 30}}>
          Chaos is
          <br />
          <span style={{color: '#ff7a1a'}}>deterministic.</span>
        </div>
        <div style={{fontFamily: F.cairo, fontWeight: 700, fontSize: 44, marginTop: 30, color: '#9fb7c2', direction: 'rtl', width: 'fit-content'}}>للفوضى قانون.</div>
      </div>

      <div style={{position: 'absolute', left: 110, bottom: 110, fontFamily: F.mono, fontSize: 24, color: '#9fb7c2', lineHeight: 1.8}}>
        <div>ẋ = σ(y − x) &nbsp; ẏ = x(ρ − z) − y &nbsp; ż = xy − βz</div>
        <div>σ=10 &nbsp;ρ=28 &nbsp;β=8/3 &nbsp;·&nbsp; RK4 &nbsp;dt=0.004</div>
        <div>
          <span style={{color: '#22d3ee'}}>●</span> x₀ = 1.00000 &nbsp;&nbsp; <span style={{color: '#ff7a1a'}}>●</span> x₀ = 1.00001
        </div>
        <div style={{color: diverged ? '#ff7a1a' : '#e6f1f5', fontSize: 34, marginTop: 8}}>
          |Δ| = {dist < 0.001 ? dist.toExponential(2) : dist.toFixed(3)}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 110,
          bottom: 110,
          textAlign: 'right',
          fontFamily: F.grotesk,
          fontSize: 34,
          color: '#e6f1f5',
          opacity: tag,
          transform: `translateY(${(1 - tag) * 20}px)`,
        }}
      >
        A difference of 0.00001
        <br />
        <span style={{color: '#ff7a1a', fontWeight: 700}}>became a different world.</span>
      </div>
    </AbsoluteFill>
  );
};
