import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLOR, FONT, RADIUS, TYPE} from '../design/tokens';
import {enter} from '../design/motion';

type Common = {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  night?: boolean;
  align?: 'right' | 'center' | 'left';
};

const useEnter = (delay = 0, y = 20) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return enter(frame, fps, {delay, y});
};

/**
 * Overline that sets context in one or two words.
 *
 * NOTE: no letter-spacing. Arabic is a joined script — positive tracking tears
 * the cursive connections apart and renders الفصل as ا ل ف ص ل. Hierarchy here
 * comes from the rule, the weight and the colour instead.
 */
export const Kicker: React.FC<Common & {rule?: boolean; color?: string}> = ({
  children,
  delay = 0,
  style,
  night,
  align = 'right',
  rule = true,
  color,
}) => {
  const e = useEnter(delay, 10);
  const tint = color ?? (night ? COLOR.nightMute : COLOR.inkMute);
  return (
    <div
      style={{
        ...e,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexDirection: align === 'center' ? 'row' : 'row',
        justifyContent:
          align === 'center' ? 'center' : align === 'left' ? 'flex-end' : 'flex-start',
        fontSize: TYPE.label,
        fontWeight: 600,
        letterSpacing: 'normal',
        color: tint,
        ...style,
      }}
    >
      {rule ? (
        <span
          style={{
            display: 'inline-block',
            width: 26,
            height: 2,
            borderRadius: 2,
            background: tint,
            opacity: 0.55,
            flexShrink: 0,
          }}
        />
      ) : null}
      <span>{children}</span>
    </div>
  );
};

export const Title: React.FC<Common & {size?: number}> = ({
  children,
  delay = 0,
  size = TYPE.h1,
  style,
  night,
  align = 'right',
}) => {
  const e = useEnter(delay, 24);
  return (
    <h1
      style={{
        ...e,
        margin: 0,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.18,
        letterSpacing: 'normal',
        color: night ? COLOR.nightInk : COLOR.ink,
        textAlign: align,
        ...style,
      }}
    >
      {children}
    </h1>
  );
};

export const Lead: React.FC<Common & {size?: number}> = ({
  children,
  delay = 0,
  size = TYPE.body,
  style,
  night,
  align = 'right',
}) => {
  const e = useEnter(delay, 18);
  return (
    <p
      style={{
        ...e,
        margin: 0,
        fontSize: size,
        fontWeight: 400,
        lineHeight: 1.62,
        color: night ? COLOR.nightMute : COLOR.inkSoft,
        textAlign: align,
        maxWidth: '38ch',
        ...style,
      }}
    >
      {children}
    </p>
  );
};

/** A tinted pill. Used for labels that name a part of a diagram. */
export const Chip: React.FC<
  Common & {color?: string; solid?: boolean; size?: number}
> = ({children, delay = 0, color = COLOR.navy, solid, style, size = TYPE.label}) => {
  const e = useEnter(delay, 8);
  return (
    <span
      style={{
        ...e,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: `${size < 18 ? 5 : 8}px ${size < 18 ? 12 : 18}px`,
        borderRadius: RADIUS.pill,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: 'normal',
        whiteSpace: 'nowrap',
        color: solid ? '#fff' : color,
        background: solid ? color : `${color}16`,
        border: `1px solid ${solid ? 'transparent' : `${color}33`}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Latin/numeric technical strings — kept LTR so bidi never mangles them. */
export const Mono: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({children, style}) => (
  <span
    style={{
      fontFamily: FONT.mono,
      direction: 'ltr',
      display: 'inline-block',
      unicodeBidi: 'isolate',
      letterSpacing: '0.02em',
      ...style,
    }}
  >
    {children}
  </span>
);
