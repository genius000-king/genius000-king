import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {COLOR, EASE, SPACE, TYPE} from '../design/tokens';
import {enter, ramp} from '../design/motion';
import {makeRng, range} from '../design/rng';
import {Scene, Split, Statement, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card} from '../components/Card';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/* ------------------------------------------------------------------ */
/* A neural constellation. Not decoration: the node count, the density  */
/* and the fact that edges outnumber nodes are the whole argument.      */
/* ------------------------------------------------------------------ */
const NODES = (() => {
  const rng = makeRng(7723);
  return range(54).map(() => ({
    x: 60 + rng() * 580,
    y: 50 + rng() * 460,
    r: 3 + rng() * 4,
    phase: rng() * Math.PI * 2,
  }));
})();

const EDGES = (() => {
  const out: [number, number][] = [];
  NODES.forEach((a, i) => {
    NODES.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 118) out.push([i, j]);
    });
  });
  return out;
})();

export const NeuralCloud: React.FC<{delay?: number; scale?: number}> = ({
  delay = 0,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const draw = ramp(frame, delay, 48);

  return (
    <svg viewBox="0 0 700 560" style={{width: 700 * scale, overflow: 'visible'}}>
      <g stroke={COLOR.neuron} strokeWidth={0.9} opacity={0.32}>
        {EDGES.map(([i, j], k) => {
          const a = NODES[i];
          const b = NODES[j];
          const on = ramp(frame, delay + 6 + (k % 40) * 0.8, 26);
          return (
            <line
              key={k}
              x1={a.x}
              y1={a.y}
              x2={a.x + (b.x - a.x) * on}
              y2={a.y + (b.y - a.y) * on}
            />
          );
        })}
      </g>
      {NODES.map((n, i) => {
        const on = ramp(frame, delay + (i % 26) * 1.1, 18);
        // A slow asynchronous shimmer: living tissue, not a dot grid.
        const live = 0.6 + 0.4 * Math.sin(frame / 22 + n.phase);
        return (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r * on}
            fill={COLOR.neuron}
            opacity={(0.45 + 0.55 * live) * on * draw}
          />
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* Scene 1 — 00:00. The unfair comparison that opens the film.          */
/* ------------------------------------------------------------------ */
export const SceneOpenCompare: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chip = enter(frame, fps, {delay: 40, y: 18, tone: 'soft'});

  return (
    <Scene>
      <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: SPACE.xl}}>
        <div style={{flex: 1.25, display: 'flex', justifyContent: 'center'}}>
          <div style={{position: 'relative'}}>
            <NeuralCloud delay={8} scale={0.94} />
            {/* The SSD, drawn to the same scale, right next to it. The joke
                lands because nothing says "small" — it simply is. */}
            <div
              style={{
                ...chip,
                position: 'absolute',
                bottom: 18,
                insetInlineStart: 26,
                width: 92,
                height: 66,
                borderRadius: 8,
                background: COLOR.ink,
                border: `1px solid ${COLOR.inkSoft}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.72)',
                fontSize: 12,
                letterSpacing: '0.12em',
                boxShadow: '0 8px 20px -6px rgba(22,34,46,0.4)',
              }}
            >
              <Mono>SSD</Mono>
            </div>
          </div>
        </div>

        <Col gap={SPACE.md} style={{flex: 1, maxWidth: 560}}>
          <Kicker delay={52}>مقارنة غير عادلة</Kicker>
          <Title delay={58} size={TYPE.h1}>
            لو تقارن المخ
            <br />
            بالـ <Mono style={{color: COLOR.amber}}>SSD</Mono>…
          </Title>
          <Lead delay={70}>
            الـ <Mono>SSD</Mono> يعتبر شيئًا تافهًا جدًا.
          </Lead>
          <Row gap={SPACE.sm} style={{marginTop: SPACE.sm}}>
            <Chip delay={82} color={COLOR.neuron}>
              ٨٦ مليار خلية
            </Chip>
            <Chip delay={88} color={COLOR.inkMute}>
              رقاقة واحدة
            </Chip>
          </Row>
        </Col>
      </div>
    </Scene>
  );
};

/* ------------------------------------------------------------------ */
/* Scene 2 — 00:06. Two symbols, and nothing else.                      */
/* ------------------------------------------------------------------ */
export const SceneBinaryOnly: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const zero = enter(frame, fps, {delay: 10, y: 34, tone: 'pop'});
  const one = enter(frame, fps, {delay: 18, y: 34, tone: 'pop'});
  const strike = interpolate(frame, [58, 82], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: bez,
  });

  return (
    <Statement>
      <Kicker delay={0}>ما يعرفه جهازك</Kicker>

      <Row gap={SPACE.xl} style={{margin: `${SPACE.md}px 0`}}>
        {[
          {v: '0', st: zero},
          {v: '1', st: one},
        ].map(({v, st}) => (
          <div
            key={v}
            style={{
              ...st,
              width: 230,
              height: 230,
              borderRadius: 40,
              background: COLOR.card,
              border: `1px solid ${COLOR.line}`,
              boxShadow: '0 2px 4px rgba(22,34,46,0.05), 0 26px 60px -18px rgba(22,34,46,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 132,
              fontWeight: 600,
              color: COLOR.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {v}
          </div>
        ))}
      </Row>

      <Title delay={34} size={TYPE.h2} align="center" style={{maxWidth: '22ch'}}>
        حاجتان فقط. لا أكثر.
      </Title>

      <div style={{position: 'relative', marginTop: SPACE.xs}}>
        <Lead delay={46} align="center" style={{maxWidth: '34ch', textAlign: 'center'}}>
          جهازك لا يعرف ما معنى «ملف».
        </Lead>
        <div
          style={{
            position: 'absolute',
            top: '52%',
            insetInlineEnd: 0,
            height: 2,
            width: `${strike * 100}%`,
            background: COLOR.danger,
            opacity: 0.85,
            borderRadius: 2,
          }}
        />
      </div>

      <Card delay={92} pad={SPACE.md} elevation="flat" style={{marginTop: SPACE.md, background: 'transparent', border: `1px dashed ${COLOR.lineStrong}`}}>
        <Lead delay={96} align="center" style={{maxWidth: '40ch', fontSize: TYPE.small, color: COLOR.inkMute}}>
          السؤال الحقيقي: هذان الرقمان — كيف يُخزَّنان فيزيائيًا؟
        </Lead>
      </Card>
    </Statement>
  );
};
