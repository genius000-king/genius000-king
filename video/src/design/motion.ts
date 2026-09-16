import {interpolate, spring, Easing} from 'remotion';
import {EASE, FPS, SPRING, SPRING_SOFT, SPRING_POP} from './tokens';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/** 0 -> 1 over `dur` frames starting at `start`, on Apple's emphasis curve. */
export const ramp = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bez,
  });

/** Symmetric fade in / hold / fade out, in frames. */
export const pulse = (
  frame: number,
  start: number,
  dur: number,
  fade = 12
) =>
  interpolate(
    frame,
    [start, start + fade, start + dur - fade, start + dur],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez}
  );

type EnterOpts = {
  /** Frames to wait before this element begins. */
  delay?: number;
  /** Vertical travel in px. Kept small on purpose — big travel reads cheap. */
  y?: number;
  /** Starting scale. 0.98 is a "settle", 0.9 is a "pop". */
  from?: number;
  tone?: 'calm' | 'soft' | 'pop';
};

/**
 * The house entrance. Everything that appears uses this, so arrivals across
 * sixteen minutes feel like one hand made them. Opacity is driven by a curve
 * rather than the spring, because a spring's tail keeps an element at 0.99
 * opacity for a long time and the fade ends up feeling muddy.
 */
export const enter = (frame: number, fps: number, opts: EnterOpts = {}) => {
  const {delay = 0, y = 22, from = 0.985, tone = 'calm'} = opts;
  const config =
    tone === 'soft' ? SPRING_SOFT : tone === 'pop' ? SPRING_POP : SPRING;

  const p = spring({frame: frame - delay, fps, config, durationInFrames: 30});
  const opacity = ramp(frame, delay, 14);

  return {
    opacity,
    transform: `translateY(${(1 - p) * y}px) scale(${from + (1 - from) * p})`,
  };
};

/** Enter, hold, then leave. Exits are quicker than entrances, as they should be. */
export const enterExit = (
  frame: number,
  fps: number,
  start: number,
  end: number,
  opts: EnterOpts = {}
) => {
  const e = enter(frame, fps, {...opts, delay: start});
  const out = interpolate(frame, [end - 10, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bez,
  });
  return {
    opacity: e.opacity * out,
    transform: `${e.transform} translateY(${(1 - out) * -10}px)`,
  };
};

/** Stagger helper: item `i` of a list, each `gap` frames behind the last. */
export const stagger = (i: number, gap = 4) => i * gap;

/** A slow, almost-imperceptible drift. Used on chapter cards (Ken Burns). */
export const drift = (frame: number, total: number, amount = 0.06) =>
  1 + amount * (frame / Math.max(total, 1));

export const SEC = FPS;
