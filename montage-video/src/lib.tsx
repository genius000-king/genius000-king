import React, {createContext, useContext} from 'react';
import {Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {FPS} from './timing';

const SceneStart = createContext(0);
export const SceneProvider = SceneStart.Provider;

/** Absolute time (seconds in the voiceover) of the current frame. */
export const useSec = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return useContext(SceneStart) + frame / fps;
};

export const ease = Easing.bezier(0.45, 0, 0.2, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

/** 0→1 between seconds a and b. */
export const ramp = (s: number, a: number, b: number, easing = ease) =>
  interpolate(s, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

/** Spring that starts at second `at`. */
export const pop = (s: number, at: number, config: Partial<{damping: number; mass: number; stiffness: number}> = {}) =>
  s < at ? 0 : spring({frame: (s - at) * FPS, fps: FPS, config: {damping: 14, mass: 0.6, stiffness: 140, ...config}});

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Quantised time for stop-motion feel. */
export const steps = (s: number, perSec = 8) => Math.floor(s * perSec) / perSec;

/** Visible between a and b with short fades. */
export const vis = (s: number, a: number, b: number, fade = 0.25) =>
  Math.min(ramp(s, a, a + fade), 1 - ramp(s, b - fade, b));

export const jitter = (seed: string, s: number, amount: number, perSec = 8) =>
  (random(`${seed}-${steps(s, perSec)}`) - 0.5) * 2 * amount;

export const ar = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export const Center: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style}}>
    {children}
  </div>
);
