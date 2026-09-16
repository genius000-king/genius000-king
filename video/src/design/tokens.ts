/**
 * Design tokens for "كيف تتخزن المعلومات".
 *
 * The identity is warm technical paper: a beige ground with a faint blueprint
 * grid, ink-navy type, and a small set of signal colours that each mean exactly
 * one thing for the whole 16 minutes. A viewer who learns that warm red is a
 * north pole in chapter 2 must still be able to trust that in chapter 8.
 */

export const COLOR = {
  // Ground
  paper: '#F2EDE3',
  paperDeep: '#E7E0D2',
  paperLift: '#FBF8F2',
  card: '#FFFDF9',

  // Ink
  ink: '#16222E',
  inkSoft: '#3C4C5C',
  inkMute: '#7C8896',
  inkFaint: '#A9B2BC',

  // Structure
  line: 'rgba(22, 34, 46, 0.10)',
  lineStrong: 'rgba(22, 34, 46, 0.20)',
  gridMinor: 'rgba(22, 34, 46, 0.045)',
  gridMajor: 'rgba(22, 34, 46, 0.085)',

  // Signal — each of these carries one fixed meaning across the whole film
  navy: '#1E3A5F',   // structure, hardware, neutral emphasis
  amber: '#B45309',  // "pay attention here"
  north: '#C2503A',  // magnetic north pole (N)
  south: '#3A6A99',  // magnetic south pole (S)
  laser: '#DE3C2C',  // optical / laser
  charge: '#2E7D6B', // electrons, stored charge
  neuron: '#6A46A8', // the brain chapter
  danger: '#B3261E',
  good: '#2E7D6B',

  // Dark chapters (the brain, chapter cards)
  night: '#101820',
  nightCard: 'rgba(255,255,255,0.06)',
  nightInk: '#F3F0EA',
  nightMute: 'rgba(243,240,234,0.60)',
} as const;

/**
 * Type scale for a 1920x1080 canvas. These are deliberately large: this is a
 * video watched at a distance, not a page read at arm's length.
 */
export const TYPE = {
  display: 104,
  h1: 72,
  h2: 50,
  h3: 36,
  body: 29,
  small: 24,
  label: 19,
  tiny: 16,
} as const;

export const FONT = {
  sans: '"IBM Plex Sans Arabic", "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", "IBM Plex Sans Arabic", ui-monospace, monospace',
} as const;

/** 8pt spacing, spacious end of the scale. */
export const SPACE = {xs: 8, sm: 16, md: 24, lg: 40, xl: 64, xxl: 96} as const;

export const RADIUS = {sm: 10, md: 16, lg: 24, xl: 34, pill: 999} as const;

/**
 * Layered shadows. A single large blur reads as a drop shadow; two layers —
 * one tight contact shadow, one wide ambient — read as an object resting on a
 * surface. That difference is most of what makes a card look expensive.
 */
export const SHADOW = {
  card: '0 1px 2px rgba(22,34,46,0.05), 0 14px 38px -10px rgba(22,34,46,0.14)',
  lift: '0 2px 4px rgba(22,34,46,0.06), 0 28px 64px -16px rgba(22,34,46,0.20)',
  inset: 'inset 0 1px 0 rgba(255,255,255,0.7)',
} as const;

/** iOS's own emphasis curve. Fast out of the gate, long gentle settle. */
export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** Calm spring: arrives with weight, never overshoots enough to wobble. */
export const SPRING = {damping: 22, mass: 0.7, stiffness: 110} as const;
/** For a single hero element that is allowed a little personality. */
export const SPRING_POP = {damping: 14, mass: 0.6, stiffness: 140} as const;
/** For anything that must not draw attention to its own arrival. */
export const SPRING_SOFT = {damping: 30, mass: 1, stiffness: 90} as const;

export const FPS = 30;
export const W = 1920;
export const H = 1080;

/** Seconds -> frames. The script's timestamps are the single source of truth. */
export const s = (seconds: number) => Math.round(seconds * FPS);
/** "m:ss" -> frames, so scene tables can be written the way the script reads. */
export const t = (clock: string) => {
  const [m, sec] = clock.split(':').map(Number);
  return s(m * 60 + sec);
};
