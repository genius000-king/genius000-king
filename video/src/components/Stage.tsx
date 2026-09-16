import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import {COLOR, FONT, TYPE} from '../design/tokens';
import {loadFonts} from '../design/fonts';

loadFonts();

/**
 * The blueprint grid. Built from repeating-linear-gradients rather than an SVG
 * pattern because it costs the compositor almost nothing, and it is painted
 * 28,560 times.
 */
const grid = (minor: string, major: string) => ({
  backgroundImage: [
    `repeating-linear-gradient(to right, ${minor} 0 1px, transparent 1px 40px)`,
    `repeating-linear-gradient(to bottom, ${minor} 0 1px, transparent 1px 40px)`,
    `repeating-linear-gradient(to right, ${major} 0 1px, transparent 1px 200px)`,
    `repeating-linear-gradient(to bottom, ${major} 0 1px, transparent 1px 200px)`,
  ].join(','),
});

export type StageTone = 'paper' | 'night';

export const Stage: React.FC<{
  children: React.ReactNode;
  tone?: StageTone;
  /** Drifts the grid slowly so static shots never feel frozen. */
  parallax?: boolean;
}> = ({children, tone = 'paper', parallax = true}) => {
  const frame = useCurrentFrame();
  const night = tone === 'night';
  const shift = parallax ? (frame * 0.06) % 200 : 0;

  return (
    <AbsoluteFill
      style={{
        background: night ? COLOR.night : COLOR.paper,
        fontFamily: FONT.sans,
        color: night ? COLOR.nightInk : COLOR.ink,
        direction: 'rtl',
        fontSize: TYPE.body,
      }}
    >
      {/* Warm key light from the upper left, exactly one soft source. */}
      <AbsoluteFill
        style={{
          background: night
            ? 'radial-gradient(120% 90% at 20% 0%, rgba(120,150,190,0.16), transparent 62%)'
            : 'radial-gradient(120% 90% at 22% 0%, rgba(255,252,244,0.95), transparent 60%)',
        }}
      />

      <AbsoluteFill
        style={{
          ...grid(
            night ? 'rgba(255,255,255,0.032)' : COLOR.gridMinor,
            night ? 'rgba(255,255,255,0.06)' : COLOR.gridMajor
          ),
          transform: `translate(${-shift}px, ${-shift * 0.5}px)`,
          width: '110%',
          height: '110%',
        }}
      />

      {/* Baked grain. Without it the flat fills read as "a CSS background". */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('img/noise.png')})`,
          backgroundRepeat: 'repeat',
          opacity: night ? 0.055 : 0.038,
          mixBlendMode: night ? 'screen' : 'multiply',
        }}
      />

      {/* Vignette — pulls the eye to centre without anyone noticing it exists. */}
      <AbsoluteFill
        style={{
          background: night
            ? 'radial-gradient(100% 75% at 50% 45%, transparent 48%, rgba(0,0,0,0.55) 100%)'
            : 'radial-gradient(100% 78% at 50% 46%, transparent 52%, rgba(72,60,40,0.10) 100%)',
        }}
      />

      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
