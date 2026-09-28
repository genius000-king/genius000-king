// 04 — Clean editorial minimalism. A network assembles, signals flow through it, it "understands".
import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {F} from '../fonts';

const LAYERS = [4, 7, 9, 7, 3];
const BLUE = '#2F4BFF';
const INK = '#0E0E12';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Node = {x: number; y: number; layer: number; idx: number};

export const Neural: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const nodes = useMemo(() => {
    const out: Node[][] = [];
    LAYERS.forEach((n, l) => {
      const x = 880 + l * 225;
      out.push(Array.from({length: n}, (_, i) => ({x, y: 540 + (i - (n - 1) / 2) * 92, layer: l, idx: i})));
    });
    return out;
  }, []);

  const edges = useMemo(() => {
    const out: {a: Node; b: Node; w: number; key: string}[] = [];
    for (let l = 0; l < nodes.length - 1; l++) {
      for (const a of nodes[l]) for (const b of nodes[l + 1]) {
        const key = `${l}-${a.idx}-${b.idx}`;
        out.push({a, b, w: random(key), key});
      }
    }
    return out;
  }, [nodes]);

  // Signal wave travels layer by layer, three passes.
  const passT = (frame - 150) / 55; // layers per second-ish
  const activation = (l: number, i: number) => {
    let v = 0;
    for (let p = 0; p < 3; p++) {
      const d = passT - p * 1.6 - l * 0.33;
      const gate = random(`act${p}-${l}-${i}`) > 0.35 ? 1 : 0.15;
      v = Math.max(v, Math.exp(-d * d * 18) * gate);
    }
    return frame < 150 ? 0 : v;
  };

  const title = spring({frame: frame - 10, fps, config: {damping: 200}});
  const understood = spring({frame: frame - 285, fps, config: {damping: 18}});
  const outro = interpolate(frame, [335, 360], [1, 0], clamp);

  return (
    <AbsoluteFill style={{background: '#F7F7F4', fontFamily: F.inter, opacity: outro}}>
      <div style={{position: 'absolute', left: 120, top: 110, color: INK, opacity: title, transform: `translateY(${(1 - title) * 30}px)`}}>
        <div style={{fontSize: 22, fontWeight: 500, letterSpacing: 5, color: BLUE}}>04 — NEURAL NETWORKS</div>
        <div style={{fontSize: 84, fontWeight: 800, lineHeight: 1, marginTop: 40, letterSpacing: -3}}>
          Don’t just
          <br />
          use it.
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -3,
            color: BLUE,
            marginTop: 10,
            opacity: interpolate(frame, [90, 110], [0, 1], clamp),
          }}
        >
          Understand it.
        </div>
        <div
          style={{
            fontFamily: F.cairo,
            fontWeight: 700,
            fontSize: 44,
            marginTop: 50,
            direction: 'rtl',
            width: 520,
            textAlign: 'right',
            color: '#555',
            opacity: interpolate(frame, [120, 140], [0, 1], clamp),
          }}
        >
          لا تستخدمه فقط. افهمه.
        </div>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {edges.map(({a, b, w, key}) => {
          const appear = interpolate(frame, [30 + a.layer * 14 + w * 20, 60 + a.layer * 14 + w * 20], [0, 1], clamp);
          const heat = Math.min(activation(a.layer, a.idx), activation(b.layer, b.idx) + 0.3);
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          return (
            <line
              key={key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={heat > 0.2 ? BLUE : INK}
              strokeWidth={0.6 + w * 1.4 + heat * 2}
              opacity={(0.12 + heat * 0.7) * appear}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - appear)}
            />
          );
        })}
        {/* travelling pulses */}
        {frame >= 150 &&
          edges
            .filter((e) => e.w > 0.72)
            .map(({a, b, key, w}) => {
              const local = passT - a.layer * 0.33 - (w - 0.72) * 2;
              const prog = ((local % 1.6) + 1.6) % 1.6;
              if (prog > 1 || local < 0 || local > 4.8) return null;
              const x = a.x + (b.x - a.x) * prog;
              const y = a.y + (b.y - a.y) * prog;
              return <circle key={`p${key}`} cx={x} cy={y} r={3.5} fill={BLUE} />;
            })}
        {nodes.flat().map((n) => {
          const s = spring({frame: frame - 20 - n.layer * 10 - n.idx * 2, fps, config: {damping: 12}});
          const act = activation(n.layer, n.idx);
          return (
            <g key={`${n.layer}-${n.idx}`} transform={`translate(${n.x} ${n.y}) scale(${s})`}>
              <circle r={26 + act * 12} fill={BLUE} opacity={act * 0.15} />
              <circle r={17} fill={act > 0.1 ? BLUE : '#F7F7F4'} stroke={INK} strokeWidth={2.5} />
              <circle r={17 * act} fill="#fff" opacity={act * 0.5} />
            </g>
          );
        })}
        {/* labels */}
        <g fontFamily={F.mono} fontSize={20} fill="#777" opacity={interpolate(frame, [60, 90], [0, 1], clamp)}>
          <text x={880} y={960} textAnchor="middle">input</text>
          <text x={1330} y={960} textAnchor="middle">hidden</text>
          <text x={1780} y={960} textAnchor="middle">output</text>
        </g>
      </svg>

      {/* output reading */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          bottom: 110,
          fontFamily: F.mono,
          fontSize: 26,
          color: INK,
          opacity: understood,
          transform: `translateY(${(1 - understood) * 20}px)`,
        }}
      >
        loss ↓ 0.0213 &nbsp;·&nbsp; ∂L/∂w computed by hand &nbsp;·&nbsp; <span style={{color: BLUE}}>understood ✓</span>
      </div>
    </AbsoluteFill>
  );
};
