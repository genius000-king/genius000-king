import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {enter} from '../design/motion';
import {Kicker} from './Type';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/**
 * Chapter dividers are the only full-bleed colour in the film. They exist to
 * give the eye a hard reset between topics, and to make a sixteen-minute video
 * feel like six short ones. The source images are vertical phone gradients, so
 * they are scaled to cover and blurred hard — we want the colour, not the shape.
 */
export const ChapterCard: React.FC<{
  index: string;
  /** The big ghost glyph — usually an Arabic-Indic numeral. */
  ordinal: string;
  title: string;
  subtitle?: string;
  image: string;
  durationInFrames: number;
}> = ({index, ordinal, title, subtitle, image, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Slow push-in. Six percent over the whole card — felt, never seen.
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.06], {
    extrapolateRight: 'clamp',
    easing: Easing.linear,
  });

  const veil = interpolate(frame, [0, 18], [1, 0], {
    extrapolateRight: 'clamp',
    easing: bez,
  });
  const out = interpolate(
    frame,
    [durationInFrames - 14, durationInFrames],
    [0, 1],
    {extrapolateLeft: 'clamp', easing: bez}
  );

  const eIndex = enter(frame, fps, {delay: 6, y: 16, tone: 'soft'});
  const eTitle = enter(frame, fps, {delay: 12, y: 26});
  const eSub = enter(frame, fps, {delay: 20, y: 18, tone: 'soft'});
  const eGhost = enter(frame, fps, {delay: 2, y: 0, from: 0.88, tone: 'soft'});
  const rule = interpolate(frame, [14, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bez,
  });

  return (
    <AbsoluteFill style={{background: COLOR.night, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <Img
          src={staticFile(image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(16px) saturate(1.28) brightness(1.06)',
            transform: 'scale(1.18)',
          }}
        />
      </AbsoluteFill>

      {/* Darkening ramp so type always clears contrast, whatever the image. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to left, rgba(8,12,16,0.80) 0%, rgba(8,12,16,0.62) 32%, rgba(8,12,16,0.30) 68%, rgba(8,12,16,0.10) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('img/noise.png')})`,
          opacity: 0.06,
          mixBlendMode: 'overlay',
        }}
      />

      <AbsoluteFill
        style={{
          direction: 'rtl',
          fontFamily: FONT.sans,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'center',
          padding: `0 ${SPACE.xxl * 1.3}px`,
          color: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Kicker delay={6} rule color="rgba(255,255,255,0.72)">
            {index}
          </Kicker>

          <div
            style={{
              height: 1,
              width: `${rule * 260}px`,
              background: 'rgba(255,255,255,0.40)',
              margin: `${SPACE.md}px 0 ${SPACE.lg}px`,
            }}
          />

          <h1
            style={{
              ...eTitle,
              margin: 0,
              fontSize: TYPE.display,
              fontWeight: 700,
              letterSpacing: 'normal',
              lineHeight: 1.08,
              textShadow: '0 2px 44px rgba(0,0,0,0.38)',
            }}
          >
            {title}
          </h1>

          {subtitle ? (
            <p
              style={{
                ...eSub,
                margin: `${SPACE.md}px 0 0`,
                fontSize: TYPE.h3,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.78)',
                maxWidth: '34ch',
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* The chapter's ordinal, set enormous and nearly invisible. It gives
            the empty half a job without adding anything to read. */}
        <div
          style={{
            ...eGhost,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 420,
            fontVariantNumeric: 'tabular-nums',
            direction: 'ltr',
            fontWeight: 700,
            lineHeight: 1,
            color: 'rgba(255,255,255,0.10)',
            userSelect: 'none',
          }}
        >
          {ordinal}
        </div>
      </AbsoluteFill>

      {/* Hard cuts are jarring at this size; a short black wipe both ways. */}
      <AbsoluteFill
        style={{background: '#000', opacity: Math.max(veil, out), pointerEvents: 'none'}}
      />
    </AbsoluteFill>
  );
};
