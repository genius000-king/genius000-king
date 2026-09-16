import React from 'react';
import {useCurrentFrame, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {ramp, enter} from '../design/motion';
import {makeRng, range} from '../design/rng';
import {Scene, Statement, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card, Panel} from '../components/Card';
import {Measure} from '../components/Magnetics';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/* =================================================================== */
/* F1 — 10:28 The head does not touch. It flies.                        */
/* =================================================================== */

const SCALE_ITEMS = [
  {n: 'شعرة إنسان', nm: 80_000, c: COLOR.inkMute},
  {n: 'خلية دم حمراء', nm: 7_000, c: COLOR.north},
  {n: 'دخان سيجارة', nm: 800, c: COLOR.inkSoft},
  {n: 'ارتفاع طيران الإبرة', nm: 3, c: COLOR.amber},
];

export const SceneFlyingHead: React.FC = () => {
  const frame = useCurrentFrame();

  const rise = ramp(frame, 40, 60);
  const scaleIn = ramp(frame, 420, 50);
  const danger = ramp(frame, 760, 46);
  const bob = Math.sin(frame / 10) * 1.6;

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1560, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>معلومة لا يعرفها كثيرون</Kicker>
            <Title delay={10} size={TYPE.h2}>الإبرة لا تلمس القرص أبدًا</Title>
          </Col>
          <Chip delay={60} color={COLOR.amber} solid size={TYPE.h3}>تطفو</Chip>
        </Row>

        <svg viewBox="-30 -180 1020 330" style={{width: '100%', display: 'block'}}>
          {/* Platter surface */}
          <rect x={0} y={40} width={960} height={54} rx={6} fill="#DED9D0" stroke={COLOR.inkSoft} strokeWidth={2} />
          <rect x={0} y={40} width={960} height={7} fill={COLOR.north} opacity={0.42} />

          {/* The slider, riding an air cushion. */}
          <g transform={`translate(400, ${16 - rise * 10 + bob})`}>
            <path d="M0 0 L150 0 L128 44 L22 44 Z" fill={COLOR.ink} />
            <rect x={66} y={-58} width={18} height={62} rx={9} fill={COLOR.inkSoft} />
          </g>

          {/* The air gap, called out because it is the whole point. */}
          <g opacity={rise}>
            <line x1={400} y1={60 + bob} x2={550} y2={60 + bob} stroke={COLOR.amber} strokeWidth={2} strokeDasharray="5 5" />
            <Measure x={560} y={50 + bob} width={0} label="" on={0} />
            <line x1={620} y1={60 + bob} x2={620} y2={40} stroke={COLOR.amber} strokeWidth={2} />
            <line x1={608} y1={60 + bob} x2={632} y2={60 + bob} stroke={COLOR.amber} strokeWidth={2} />
            <line x1={608} y1={40} x2={632} y2={40} stroke={COLOR.amber} strokeWidth={2} />
            <text x={646} y={56} fontFamily={FONT.sans} fontSize={22} fontWeight={700} fill={COLOR.amber} direction="rtl" textAnchor="end">
              وسادة هواء
            </text>
            <text x={646} y={80} fontFamily={FONT.mono} fontSize={18} fill={COLOR.inkMute} textAnchor="end">
              ~3 nm
            </text>
          </g>

          <text x={0} y={-140} fontFamily={FONT.sans} fontSize={21} fill={COLOR.inkSoft} direction="rtl" textAnchor="end" opacity={rise}>
            المجال المغناطيسي يعبر الفراغ — لا حاجة للتلامس
          </text>
        </svg>

        {/* Scale ladder: the number means nothing until it is next to a hair. */}
        <div style={{opacity: scaleIn, display: 'grid', gap: 12}}>
          {SCALE_ITEMS.map((it, i) => {
            const w = Math.log10(it.nm) / Math.log10(80_000);
            const grow = ramp(frame, 440 + i * 46, 42);
            return (
              <Row key={it.n} gap={SPACE.md} style={{alignItems: 'center'}}>
                <div style={{width: 260, textAlign: 'right', fontSize: TYPE.small, fontWeight: 600, flexShrink: 0}}>{it.n}</div>
                <div style={{flex: 1, height: 30, background: 'rgba(22,34,46,0.04)', borderRadius: 8, overflow: 'hidden'}}>
                  <div style={{width: `${Math.max(w, 0.04) * grow * 100}%`, height: '100%', background: it.c, borderRadius: 8, opacity: 0.85}} />
                </div>
                <Mono style={{width: 150, fontSize: TYPE.label, color: it.c, fontWeight: 600}}>
                  {it.nm.toLocaleString('en-US')} nm
                </Mono>
              </Row>
            );
          })}
        </div>

        <Card delay={760} pad={SPACE.lg} accent={COLOR.danger} style={{opacity: danger}}>
          <Lead delay={770} align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.5}}>
            ولهذا تحديدًا: إسقاط قرص صلب وهو يعمل قد يجعل الإبرة تحرث السطح —
            بينما الـ <Mono>SSD</Mono> لا يلاحظ شيئًا.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* F2 — 11:04 Every drive is a computer with a job you never see.       */
/* =================================================================== */

export const SceneDriveBrain: React.FC = () => {
  const frame = useCurrentFrame();
  const board = ramp(frame, 20, 42);
  const BAD = 260;
  const damage = ramp(frame, BAD, 28);
  const move = interpolate(frame, [BAD + 90, BAD + 200], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez,
  });

  const SRC = {r: 2, c: 3};
  const DST = {r: 4, c: 8};

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1540, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>داخل كل قرص</Kicker>
            <Title delay={10} size={TYPE.h2}>كمبيوتر صغير يعمل بلا أن تعرف</Title>
          </Col>
          <Chip delay={BAD} color={COLOR.danger} solid size={TYPE.small}>قطاع تالف</Chip>
        </Row>

        <svg viewBox="0 -20 1000 340" style={{width: '100%', display: 'block'}}>
          {range(6).map((r) =>
            range(14).map((c) => {
              const isSrc = r === SRC.r && c === SRC.c;
              const isDst = r === DST.r && c === DST.c;
              const on = ramp(frame, 30 + ((r * 14 + c) % 40) * 2, 18);
              const fill = isSrc
                ? damage > 0.5
                  ? COLOR.danger
                  : COLOR.navy
                : isDst && move > 0.5
                ? COLOR.good
                : 'rgba(22,34,46,0.07)';
              return (
                <rect
                  key={`${r}-${c}`}
                  x={20 + c * 70}
                  y={20 + r * 48}
                  width={58}
                  height={36}
                  rx={6}
                  fill={fill}
                  opacity={on * (isSrc && damage > 0.5 ? 0.45 : 1)}
                  stroke={isSrc && damage > 0.5 ? COLOR.danger : 'none'}
                  strokeWidth={2}
                />
              );
            })
          )}

          {/* The data physically relocating, on its own initiative. */}
          {move > 0 && move < 1 ? (
            <circle
              cx={20 + (SRC.c + (DST.c - SRC.c) * move) * 70 + 29}
              cy={20 + (SRC.r + (DST.r - SRC.r) * move) * 48 + 18}
              r={13}
              fill={COLOR.good}
            />
          ) : null}

          <path
            d={`M${20 + SRC.c * 70 + 29} ${20 + SRC.r * 48 + 18} Q ${520} ${60} ${20 + DST.c * 70 + 29} ${20 + DST.r * 48 + 18}`}
            fill="none"
            stroke={COLOR.good}
            strokeWidth={2}
            strokeDasharray="6 8"
            opacity={move * 0.55}
          />
        </svg>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.md}}>
          <Panel title="ما تراه أنت" delay={520} pad={SPACE.md}>
            <Lead delay={530} size={TYPE.small} style={{maxWidth: 'none'}}>
              الملف موجود. يُفتح كما في كل مرة. لا شيء تغيّر.
            </Lead>
          </Panel>
          <Panel title="ما فعله القرص" delay={560} pad={SPACE.md}>
            <Lead delay={570} size={TYPE.small} style={{maxWidth: 'none'}}>
              اكتشف تلفًا، نسخ البيانات إلى قطاع سليم، وحدّث خريطته الداخلية —
              وحده، بلا إذن.
            </Lead>
          </Panel>
        </div>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* B — 11:26 The idea the whole film was building to.                   */
/* =================================================================== */

const HISTORY = [
  {n: 'نقش على حجر', s: 'إزاحة مادة', y: '٣٠٠٠ ق.م', c: COLOR.inkMute},
  {n: 'حبر على ورق', s: 'إضافة مادة', y: '١٠٥ م', c: COLOR.inkSoft},
  {n: 'أقطاب مغناطيسية', s: 'قلب اتجاه', y: '١٩٥٦', c: COLOR.north},
  {n: 'حفر تحت ليزر', s: 'تشويه سطح', y: '١٩٨٢', c: COLOR.laser},
  {n: 'إلكترونات محبوسة', s: 'نقل شحنة', y: '١٩٨٧', c: COLOR.charge},
];

export const SceneBigIdea: React.FC = () => {
  const frame = useCurrentFrame();
  const line = ramp(frame, 60, 80);
  const punch = ramp(frame, 620, 50);

  return (
    <Scene>
      <Col gap={SPACE.xl} style={{flex: 1, justifyContent: 'center', maxWidth: 1660, margin: '0 auto', width: '100%'}}>
        <Statement>
          <Col gap={SPACE.md} style={{alignItems: 'center'}}>
            <Kicker delay={4} align="center">خذ هذه الفكرة من المقطع كله</Kicker>
            <Title delay={12} size={TYPE.h1} align="center" style={{maxWidth: '20ch'}}>
              حفظ المعلومة هو تغيير حالة شيء ملموس
            </Title>
          </Col>
        </Statement>

        <div style={{position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              top: 46,
              insetInlineEnd: 0,
              height: 2,
              width: `${line * 100}%`,
              background: COLOR.lineStrong,
            }}
          />
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${HISTORY.length}, 1fr)`, gap: SPACE.sm}}>
            {HISTORY.map((h, i) => {
              const on = ramp(frame, 120 + i * 78, 40);
              return (
                <Col key={h.n} gap={SPACE.sm} style={{alignItems: 'center', opacity: on, transform: `translateY(${(1 - on) * 14}px)`}}>
                  <div style={{width: 22, height: 22, borderRadius: 11, background: h.c, marginTop: 36, boxShadow: `0 0 0 6px ${COLOR.paper}`}} />
                  <Mono style={{fontSize: TYPE.label, color: COLOR.inkMute}}>{h.y}</Mono>
                  <span style={{fontSize: TYPE.small, fontWeight: 700, textAlign: 'center', color: COLOR.ink}}>{h.n}</span>
                  <span style={{fontSize: TYPE.label, color: h.c, fontWeight: 600, textAlign: 'center'}}>{h.s}</span>
                </Col>
              );
            })}
          </div>
        </div>

        <Card delay={620} pad={SPACE.lg} accent={COLOR.ink} style={{opacity: punch}}>
          <Lead delay={630} align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.5}}>
            خمسة آلاف سنة، والمبدأ لم يتغيّر. تغيّر فقط <strong>ما الذي نغيّره</strong> —
            وكم مرة في الثانية نستطيع ذلك.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};
