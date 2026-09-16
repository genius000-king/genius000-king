import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLOR, RADIUS, SHADOW, SPACE, TYPE} from '../design/tokens';
import {enter} from '../design/motion';

/**
 * The single surface primitive. Everything that needs to sit above the paper
 * uses this, at one of three elevations — so depth stays a language rather
 * than a per-scene improvisation.
 */
export const Card: React.FC<{
  children: React.ReactNode;
  delay?: number;
  pad?: number;
  elevation?: 'flat' | 'rest' | 'lift';
  night?: boolean;
  accent?: string;
  style?: React.CSSProperties;
}> = ({
  children,
  delay = 0,
  pad = SPACE.lg,
  elevation = 'rest',
  night,
  accent,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = enter(frame, fps, {delay, y: 26});

  return (
    <div
      style={{
        ...e,
        position: 'relative',
        padding: pad,
        borderRadius: RADIUS.lg,
        background: night ? COLOR.nightCard : COLOR.card,
        border: `1px solid ${night ? 'rgba(255,255,255,0.10)' : COLOR.line}`,
        boxShadow:
          elevation === 'flat'
            ? 'none'
            : elevation === 'lift'
            ? SHADOW.lift
            : SHADOW.card,
        backdropFilter: night ? 'blur(14px)' : undefined,
        ...style,
      }}
    >
      {accent ? (
        <div
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: pad * 0.6,
            bottom: pad * 0.6,
            width: 3,
            borderRadius: 3,
            background: accent,
          }}
        />
      ) : null}
      {children}
    </div>
  );
};

/** A card with a title row, which is the shape most scenes actually want. */
export const Panel: React.FC<{
  title?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  night?: boolean;
  pad?: number;
  style?: React.CSSProperties;
}> = ({title, badge, children, delay = 0, night, pad = SPACE.lg, style}) => (
  <Card delay={delay} night={night} pad={pad} style={style}>
    {(title || badge) && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.md,
          marginBottom: SPACE.md,
          paddingBottom: SPACE.sm,
          borderBottom: `1px solid ${night ? 'rgba(255,255,255,0.08)' : COLOR.line}`,
        }}
      >
        <div
          style={{
            fontSize: TYPE.h3,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: night ? COLOR.nightInk : COLOR.ink,
          }}
        >
          {title}
        </div>
        {badge}
      </div>
    )}
    {children}
  </Card>
);
