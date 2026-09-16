import React from 'react';
import {AbsoluteFill} from 'remotion';
import {SPACE} from '../design/tokens';
import {Stage, StageTone} from './Stage';
import {Kicker, Title} from './Type';

const MARGIN = 128;

/** Full-bleed stage with the film's standard safe margins. */
export const Scene: React.FC<{
  children: React.ReactNode;
  tone?: StageTone;
  pad?: number;
  parallax?: boolean;
}> = ({children, tone, pad = MARGIN, parallax}) => (
  <Stage tone={tone} parallax={parallax}>
    <AbsoluteFill style={{padding: pad, display: 'flex'}}>{children}</AbsoluteFill>
  </Stage>
);

/**
 * Text on the right, diagram on the left. In an RTL film the eye lands on the
 * right first, so the words set up the picture rather than competing with it.
 */
export const Split: React.FC<{
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  body?: React.ReactNode;
  figure: React.ReactNode;
  tone?: StageTone;
  /** 0.38 means the text column takes 38% of the width. */
  ratio?: number;
  titleSize?: number;
  delay?: number;
}> = ({kicker, title, body, figure, tone, ratio = 0.36, titleSize, delay = 0}) => {
  const night = tone === 'night';
  return (
    <Scene tone={tone}>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `${(1 - ratio) * 100}% ${ratio * 100}%`,
          alignItems: 'center',
          gap: SPACE.xl,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minWidth: 0,
          }}
        >
          {figure}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACE.md}}>
          {kicker ? (
            <Kicker delay={delay} night={night}>
              {kicker}
            </Kicker>
          ) : null}
          {title ? (
            <Title delay={delay + 5} night={night} size={titleSize}>
              {title}
            </Title>
          ) : null}
          {body}
        </div>
      </div>
    </Scene>
  );
};

/** A single centred statement. Used for the film's turning points. */
export const Statement: React.FC<{
  children: React.ReactNode;
  tone?: StageTone;
  above?: React.ReactNode;
  below?: React.ReactNode;
}> = ({children, tone, above, below}) => (
  <Scene tone={tone}>
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.lg,
        textAlign: 'center',
      }}
    >
      {above}
      {children}
      {below}
    </div>
  </Scene>
);

export const Row: React.FC<{
  children: React.ReactNode;
  gap?: number;
  style?: React.CSSProperties;
}> = ({children, gap = SPACE.md, style}) => (
  <div style={{display: 'flex', alignItems: 'center', gap, ...style}}>
    {children}
  </div>
);

export const Col: React.FC<{
  children: React.ReactNode;
  gap?: number;
  style?: React.CSSProperties;
}> = ({children, gap = SPACE.md, style}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap, ...style}}>
    {children}
  </div>
);
