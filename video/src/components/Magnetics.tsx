import React from 'react';
import {useCurrentFrame, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT} from '../design/tokens';
import {ramp} from '../design/motion';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

export const CELL_W = 96;
export const CELL_H = 118;

/** One magnetised region. `up` means its north end points along the track. */
export const Domain: React.FC<{
  x: number;
  up: boolean;
  /** 0 = not yet placed, 1 = fully drawn. */
  on: number;
  /** 0 = at rest, 1 = mid-flip. Drives the write animation. */
  flip?: number;
  dim?: boolean;
  highlight?: boolean;
}> = ({x, up, on, flip = 0, dim, highlight}) => {
  // Colour is the whole mnemonic: warm red is north, cool blue is south, for
  // sixteen minutes, without exception.
  const north = COLOR.north;
  const south = COLOR.south;
  const h = CELL_H * on;
  const y = (CELL_H - h) / 2;
  const spin = flip * 180;

  return (
    <g transform={`translate(${x},0)`} opacity={dim ? 0.3 : 1}>
      <rect
        x={2}
        y={0}
        width={CELL_W - 4}
        height={CELL_H}
        rx={10}
        fill={highlight ? 'rgba(180,83,9,0.10)' : 'rgba(22,34,46,0.03)'}
        stroke={highlight ? COLOR.amber : COLOR.line}
        strokeWidth={highlight ? 2 : 1}
      />
      <g
        transform={`translate(${CELL_W / 2}, ${CELL_H / 2}) rotate(${spin}) translate(${-CELL_W / 2}, ${-CELL_H / 2})`}
        opacity={on}
      >
        {/* Two halves of one bar magnet — never two separate objects. */}
        <rect
          x={16}
          y={y + 8}
          width={CELL_W - 32}
          height={h / 2 - 8}
          rx={6}
          fill={up ? north : south}
        />
        <rect
          x={16}
          y={y + h / 2}
          width={CELL_W - 32}
          height={h / 2 - 8}
          rx={6}
          fill={up ? south : north}
        />
        <text
          x={CELL_W / 2}
          y={y + h * 0.3}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONT.mono}
          fontSize={26}
          fontWeight={700}
          fill="#fff"
        >
          {up ? 'N' : 'S'}
        </text>
        <text
          x={CELL_W / 2}
          y={y + h * 0.74}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={FONT.mono}
          fontSize={26}
          fontWeight={700}
          fill="#fff"
        >
          {up ? 'S' : 'N'}
        </text>
      </g>
    </g>
  );
};

/**
 * The read/write head. Drawn as a slider body with a visible coil, because the
 * coil is the part that does the work and the script spends a minute on it.
 */
export const Head: React.FC<{
  x: number;
  /** -1 writes south, +1 writes north, 0 is passive reading. */
  current?: number;
  glow?: number;
  label?: string;
}> = ({x, current = 0, glow = 0, label}) => {
  const frame = useCurrentFrame();
  const wobble = Math.sin(frame / 9) * 0.6;
  const fieldColor =
    current > 0 ? COLOR.north : current < 0 ? COLOR.south : COLOR.navy;

  return (
    <g transform={`translate(${x}, ${-96 + wobble})`}>
      {/* Arm */}
      <rect x={38} y={-74} width={14} height={84} rx={7} fill={COLOR.inkSoft} />
      {/* Slider body */}
      <path
        d="M0 0 L90 0 L74 58 L16 58 Z"
        fill={COLOR.ink}
        stroke={COLOR.inkSoft}
        strokeWidth={1.5}
      />
      {/* Coil windings */}
      <g stroke={fieldColor} strokeWidth={4} fill="none" strokeLinecap="round">
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M22 ${14 + i * 10} q23 ${current >= 0 ? 9 : -9} 46 0`}
            opacity={0.9}
          />
        ))}
      </g>
      <text
        x={45}
        y={-88}
        textAnchor="middle"
        fontFamily={FONT.sans}
        fontSize={19}
        fontWeight={600}
        fill={COLOR.inkSoft}
      >
        {label ?? ''}
      </text>

      {/* The write field, only visible while current flows. */}
      {glow > 0 ? (
        <ellipse
          cx={45}
          cy={74}
          rx={54 * glow}
          ry={26 * glow}
          fill={fieldColor}
          opacity={0.22 * glow}
        />
      ) : null}
    </g>
  );
};

/** The bits the head emits, appearing one at a time as it passes each boundary. */
export const BitStream: React.FC<{
  bits: string[];
  /** How many are revealed so far, fractional for a partial fade. */
  revealed: number;
  x: number;
  y: number;
  gap?: number;
  highlightLast?: boolean;
}> = ({bits, revealed, x, y, gap = CELL_W, highlightLast}) => (
  <g transform={`translate(${x},${y})`}>
    {bits.map((b, i) => {
      const o = interpolate(revealed, [i, i + 0.7], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const isLast = highlightLast && i === Math.floor(revealed - 0.01);
      return (
        <g key={i} transform={`translate(${i * gap}, 0)`} opacity={o}>
          <rect
            x={gap * 0.14}
            y={-6}
            width={gap * 0.72}
            height={58}
            rx={9}
            fill={isLast ? COLOR.amber : 'rgba(22,34,46,0.06)'}
            stroke={isLast ? 'none' : COLOR.line}
          />
          <text
            x={gap / 2}
            y={24}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily={FONT.mono}
            fontSize={32}
            fontWeight={600}
            fill={isLast ? '#fff' : COLOR.ink}
          >
            {b}
          </text>
        </g>
      );
    })}
  </g>
);

/** A dimension line with a caption — the language of a technical drawing. */
export const Measure: React.FC<{
  x: number;
  y: number;
  width: number;
  label: string;
  on: number;
  color?: string;
}> = ({x, y, width, label, on, color = COLOR.inkMute}) => {
  const w = width * on;
  return (
    <g transform={`translate(${x},${y})`} opacity={on}>
      <line x1={0} y1={0} x2={w} y2={0} stroke={color} strokeWidth={1.5} />
      <line x1={0} y1={-8} x2={0} y2={8} stroke={color} strokeWidth={1.5} />
      <line x1={w} y1={-8} x2={w} y2={8} stroke={color} strokeWidth={1.5} />
      <text
        x={width / 2}
        y={-16}
        textAnchor="middle"
        fontFamily={FONT.sans}
        fontSize={19}
        fontWeight={500}
        fill={color}
        direction="rtl"
      >
        {label}
      </text>
    </g>
  );
};

/** Leader line + label, the way a real exploded-view drawing annotates a part. */
export const Callout: React.FC<{
  from: [number, number];
  to: [number, number];
  label: string;
  sub?: string;
  on: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
}> = ({from, to, label, sub, on, color = COLOR.ink, anchor = 'start'}) => {
  const draw = interpolate(on, [0, 0.6], [0, 1], {extrapolateRight: 'clamp', easing: bez});
  const textIn = interpolate(on, [0.45, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const mx = from[0] + (to[0] - from[0]) * draw;
  const my = from[1] + (to[1] - from[1]) * draw;

  return (
    <g>
      <circle cx={from[0]} cy={from[1]} r={4.5} fill={color} opacity={on} />
      <line x1={from[0]} y1={from[1]} x2={mx} y2={my} stroke={color} strokeWidth={1.4} opacity={on * 0.7} />
      <g opacity={textIn} transform={`translate(${to[0]}, ${to[1]})`}>
        <text
          x={0}
          y={-6}
          textAnchor={anchor}
          fontFamily={FONT.sans}
          fontSize={24}
          fontWeight={600}
          fill={color}
          direction="rtl"
        >
          {label}
        </text>
        {sub ? (
          <text
            x={0}
            y={22}
            textAnchor={anchor}
            fontFamily={FONT.sans}
            fontSize={19}
            fontWeight={400}
            fill={COLOR.inkMute}
            direction="rtl"
          >
            {sub}
          </text>
        ) : null}
      </g>
    </g>
  );
};

export {ramp};
