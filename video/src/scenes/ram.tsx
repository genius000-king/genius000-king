import React from 'react';
import {useCurrentFrame, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {ramp} from '../design/motion';
import {range} from '../design/rng';
import {Scene, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card, Panel} from '../components/Card';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/* =================================================================== */
/* R1 — 8:51 A capacitor is a bucket, not a vault.                      */
/* =================================================================== */

const Capacitor: React.FC<{charge: number; leak?: number}> = ({charge, leak = 0}) => {
  const frame = useCurrentFrame();
  return (
    <g>
      <line x1={140} y1={0} x2={140} y2={44} stroke={COLOR.inkSoft} strokeWidth={4} />
      <line x1={70} y1={44} x2={210} y2={44} stroke={COLOR.inkSoft} strokeWidth={7} strokeLinecap="round" />
      <line x1={70} y1={74} x2={210} y2={74} stroke={COLOR.inkSoft} strokeWidth={7} strokeLinecap="round" />
      <line x1={140} y1={74} x2={140} y2={118} stroke={COLOR.inkSoft} strokeWidth={4} />
      {/* The stored charge, drawn as a level between the plates. */}
      <rect
        x={74}
        y={48 - 0 * charge}
        width={132}
        height={22 * charge}
        fill={COLOR.charge}
        opacity={0.85}
      />
      {/* Leakage: the reason DRAM must be refreshed thousands of times a second. */}
      {leak > 0
        ? range(4).map((i) => {
            const p = ((frame / 2.2 + i * 12) % 48) / 48;
            return (
              <circle
                key={i}
                cx={92 + i * 32}
                cy={78 + p * 44}
                r={4}
                fill={COLOR.charge}
                opacity={(1 - p) * 0.7 * leak}
              />
            );
          })
        : null}
    </g>
  );
};

export const SceneRamCell: React.FC = () => {
  const frame = useCurrentFrame();
  const fill = ramp(frame, 40, 34);
  const leak = ramp(frame, 200, 60);

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1500, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>الذاكرة العشوائية</Kicker>
          <Title delay={10} size={TYPE.h2}>نفس الفكرة. وعاء مختلف.</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.xl}}>
          <Panel title="SSD — بوابة عائمة" delay={20} badge={<Chip delay={30} color={COLOR.charge}>سنوات</Chip>}>
            <svg viewBox="0 0 280 150" style={{width: '100%'}}>
              <rect x={20} y={30} width={240} height={70} rx={8} fill={COLOR.charge} opacity={0.25} stroke={COLOR.charge} strokeWidth={2.5} />
              {range(14).map((i) => (
                <circle key={i} cx={38 + (i % 7) * 34} cy={50 + Math.floor(i / 7) * 32} r={5} fill={COLOR.charge} opacity={fill} />
              ))}
              <rect x={20} y={16} width={240} height={10} fill="rgba(22,34,46,0.16)" />
              <rect x={20} y={104} width={240} height={10} fill="rgba(22,34,46,0.16)" />
              <text x={140} y={140} textAnchor="middle" fontFamily={FONT.sans} fontSize={19} fill={COLOR.inkMute} direction="rtl">
                معزولة تمامًا — لا تسرّب
              </text>
            </svg>
          </Panel>

          <Panel title="RAM — مكثّف" delay={60} badge={<Chip delay={70} color={COLOR.amber} solid>أجزاء من الثانية</Chip>}>
            <svg viewBox="0 0 280 150" style={{width: '100%'}}>
              <g transform="translate(0, 6)">
                <Capacitor charge={fill} leak={leak} />
              </g>
              <text x={140} y={140} textAnchor="middle" fontFamily={FONT.sans} fontSize={19} fill={COLOR.amber} direction="rtl">
                يسرّب دائمًا — يحتاج تعبئة متكررة
              </text>
            </svg>
          </Panel>
        </div>

        <Lead delay={260} align="center" style={{maxWidth: '62ch', textAlign: 'center', margin: '0 auto'}}>
          المكثّف لا يجيد الحفظ — لكنه يمتلئ ويفرغ بسرعة مذهلة. وهذا بالضبط
          ما نريده من الرام.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* R2 — 9:07 The hierarchy. Latency, to scale, in human time.           */
/* =================================================================== */

const TIERS = [
  {n: 'سجلّات المعالج', ns: 0.3, human: 'ثانية واحدة', c: COLOR.ink, w: 0.02},
  {n: 'ذاكرة مخبّأة L1', ns: 1, human: '٣ ثوانٍ', c: COLOR.navy, w: 0.05},
  {n: 'الرام', ns: 80, human: '٤ دقائق', c: COLOR.charge, w: 0.22},
  {n: 'SSD — NVMe', ns: 50_000, human: 'يومان', c: COLOR.amber, w: 0.55},
  {n: 'قرص صلب', ns: 8_000_000, human: 'عشر سنوات', c: COLOR.north, w: 1},
];

export const SceneRamHierarchy: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1540, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>لماذا يجب أن يكون الرام سريعًا</Kicker>
          <Title delay={10} size={TYPE.h2}>زمن الوصول — لو كان المعالج بحجمنا</Title>
        </Col>

        <Col gap={SPACE.md}>
          {TIERS.map((t, i) => {
            const on = ramp(frame, 60 + i * 55, 40);
            const grow = ramp(frame, 74 + i * 55, 46);
            return (
              <Row key={t.n} gap={SPACE.md} style={{opacity: on, alignItems: 'center'}}>
                <div style={{width: 250, textAlign: 'right', fontSize: TYPE.small, fontWeight: 600, flexShrink: 0}}>
                  {t.n}
                </div>
                <div style={{flex: 1, height: 44, background: 'rgba(22,34,46,0.04)', borderRadius: 10, overflow: 'hidden'}}>
                  <div
                    style={{
                      width: `${t.w * grow * 100}%`,
                      height: '100%',
                      background: t.c,
                      borderRadius: 10,
                      opacity: 0.88,
                    }}
                  />
                </div>
                <div style={{width: 190, textAlign: 'left', flexShrink: 0}}>
                  <Mono style={{fontSize: TYPE.small, fontWeight: 600, color: t.c}}>{t.human}</Mono>
                </div>
              </Row>
            );
          })}
        </Col>

        <Lead delay={400} align="center" style={{maxWidth: '64ch', textAlign: 'center', margin: '0 auto'}}>
          المعالج لا ينتظر بلطف. إن لم تصله البيانات في الوقت المناسب، يقف —
          ولهذا يجب أن يكون الرام أسرع من أي تخزين تملكه.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* R3 — 9:28 The strangest fact in the film: reading destroys.          */
/* =================================================================== */

export const SceneDestructiveRead: React.FC = () => {
  const frame = useCurrentFrame();

  const READ = 150;
  const drain = interpolate(frame, [READ, READ + 70], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez,
  });
  const refill = interpolate(frame, [READ + 150, READ + 220], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez,
  });
  const charge = frame < READ + 150 ? drain : refill;
  const pulled = interpolate(frame, [READ, READ + 90], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez,
  });

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1500, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>مفارقة</Kicker>
            <Title delay={10} size={TYPE.h2}>قراءة الرام تُتلف ما تقرأه</Title>
          </Col>
          <Chip delay={READ} color={COLOR.danger} solid size={TYPE.h3}>
            {frame < READ + 150 ? 'القراءة تفرّغ الخلية' : 'إعادة كتابة فورية'}
          </Chip>
        </Row>

        <svg viewBox="-40 -40 900 280" style={{width: '100%', display: 'block'}}>
          <g transform="translate(0, 30)">
            <Capacitor charge={charge} />
          </g>
          <text x={140} y={200} textAnchor="middle" fontFamily={FONT.sans} fontSize={21} fontWeight={600} fill={COLOR.inkSoft} direction="rtl">
            الخلية
          </text>

          {/* The bit line: it does not copy the charge, it takes it. */}
          <line x1={230} y1={92} x2={720} y2={92} stroke={COLOR.line} strokeWidth={3} />
          {range(5).map((i) => {
            const p = Math.max(0, Math.min(1, pulled * 1.4 - i * 0.1));
            return (
              <circle
                key={i}
                cx={236 + p * 460}
                cy={92}
                r={6}
                fill={COLOR.charge}
                opacity={p > 0 && p < 1 ? 0.9 : 0}
              />
            );
          })}

          <rect x={720} y={52} width={140} height={80} rx={12} fill={COLOR.ink} />
          <text x={790} y={98} textAnchor="middle" fontFamily={FONT.mono} fontSize={19} fill="#fff">SENSE</text>
          <text x={790} y={200} textAnchor="middle" fontFamily={FONT.sans} fontSize={21} fontWeight={600} fill={COLOR.inkSoft} direction="rtl">
            المُستشعِر
          </text>
        </svg>

        <Card delay={READ + 230} pad={SPACE.lg} accent={COLOR.charge}>
          <Lead delay={READ + 240} align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.5}}>
            المُستشعِر لا ينسخ الشحنة — <strong>يأخذها</strong>. فتُكتب الخلية من جديد
            فورًا بعد كل قراءة. لا توقّف، حركة دائمة.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* R4 — 9:42 Where RAM sits in the path.                                */
/* =================================================================== */

export const SceneDataPath: React.FC = () => {
  const frame = useCurrentFrame();
  const flow = (frame % 90) / 90;

  const NODES = [
    {n: 'التخزين', s: 'قرص صلب · SSD · قرص ضوئي', c: COLOR.north, x: 40},
    {n: 'الرام', s: 'مؤقت — وسريع جدًا', c: COLOR.charge, x: 360},
    {n: 'المعالج', s: 'لا ينتظر', c: COLOR.ink, x: 680},
  ];

  return (
    <Scene>
      <Col gap={SPACE.xl} style={{flex: 1, justifyContent: 'center', maxWidth: 1500, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>المسار</Kicker>
          <Title delay={10} size={TYPE.h2}>الرام محطة عبور، لا مستودع</Title>
        </Col>

        <svg viewBox="0 -40 960 260" style={{width: '100%', display: 'block'}}>
          {NODES.map((n, i) => {
            const on = ramp(frame, 30 + i * 46, 38);
            return (
              <g key={n.n} opacity={on}>
                <rect x={n.x} y={0} width={240} height={110} rx={20} fill={COLOR.card} stroke={COLOR.line} />
                <rect x={n.x} y={0} width={5} height={110} rx={3} fill={n.c} />
                <text x={n.x + 120} y={46} textAnchor="middle" fontFamily={FONT.sans} fontSize={27} fontWeight={700} fill={COLOR.ink} direction="rtl">
                  {n.n}
                </text>
                <text x={n.x + 120} y={78} textAnchor="middle" fontFamily={FONT.sans} fontSize={17} fill={COLOR.inkMute} direction="rtl">
                  {n.s}
                </text>
              </g>
            );
          })}

          {[0, 1].map((i) => {
            const on = ramp(frame, 110 + i * 46, 34);
            const x0 = NODES[i].x + 240;
            const x1 = NODES[i + 1].x;
            return (
              <g key={i} opacity={on}>
                <line x1={x0 + 10} y1={55} x2={x1 - 16} y2={55} stroke={COLOR.inkFaint} strokeWidth={2} />
                <path d={`M${x1 - 18} 47 L${x1 - 6} 55 L${x1 - 18} 63 Z`} fill={COLOR.inkFaint} />
                {range(3).map((k) => {
                  const p = (flow + k / 3) % 1;
                  return (
                    <circle key={k} cx={x0 + 10 + p * (x1 - x0 - 26)} cy={55} r={5} fill={NODES[i + 1].c} opacity={0.8} />
                  );
                })}
              </g>
            );
          })}
        </svg>

        <Lead delay={240} align="center" style={{maxWidth: '62ch', textAlign: 'center', margin: '0 auto'}}>
          يأخذ ما يحتاجه المعالج، ثم يتخلّص منه فورًا. اقطع الكهرباء — يفرغ كل شيء.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* R5 — 9:55 The whole film, in one table.                              */
/* =================================================================== */

const COLS = [
  {n: 'القرص الصلب', c: COLOR.north},
  {n: 'القرص الضوئي', c: COLOR.laser},
  {n: 'SSD', c: COLOR.charge},
  {n: 'الرام', c: COLOR.amber},
];

const ROWS = [
  {k: 'الوسط الفيزيائي', v: ['مغناطيس', 'ضوء', 'شحنة محبوسة', 'شحنة في مكثّف']},
  {k: 'ما الذي يتغيّر', v: ['اتجاه الأقطاب', 'شكل السطح', 'عدد الإلكترونات', 'مستوى الشحنة']},
  {k: 'هل يتحرك شيء', v: ['نعم — يدور', 'نعم — يدور', 'لا', 'لا']},
  {k: 'يبقى بلا كهرباء', v: ['سنوات', 'عقود', 'حوالي سنة', 'أجزاء من الثانية']},
  {k: 'التعقيد الداخلي', v: ['متوسط', 'منخفض', 'عالٍ جدًا', 'منخفض عمدًا']},
];

export const SceneComparison: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1660, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>الخلاصة</Kicker>
          <Title delay={10} size={TYPE.h2}>أربع طرق. مبدأ واحد.</Title>
        </Col>

        <Card delay={40} pad={0} elevation="lift" style={{overflow: 'hidden'}}>
          {/* Header */}
          <div style={{display: 'grid', gridTemplateColumns: '260px repeat(4, 1fr)', borderBottom: `1px solid ${COLOR.lineStrong}`}}>
            <div style={{padding: '22px 26px'}} />
            {COLS.map((c, i) => (
              <div
                key={c.n}
                style={{
                  padding: '22px 20px',
                  textAlign: 'center',
                  fontSize: TYPE.h3,
                  fontWeight: 700,
                  color: c.c,
                  opacity: ramp(frame, 60 + i * 12, 26),
                  borderInlineStart: `1px solid ${COLOR.line}`,
                }}
              >
                {c.n}
              </div>
            ))}
          </div>

          {/* Rows land one at a time — the "table builds itself" beat. */}
          {ROWS.map((r, ri) => {
            const rowOn = ramp(frame, 150 + ri * 105, 30);
            return (
              <div
                key={r.k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '260px repeat(4, 1fr)',
                  borderBottom: ri === ROWS.length - 1 ? 'none' : `1px solid ${COLOR.line}`,
                  background: ri % 2 ? 'rgba(22,34,46,0.018)' : 'transparent',
                  opacity: rowOn,
                  transform: `translateY(${(1 - rowOn) * 12}px)`,
                }}
              >
                <div style={{padding: '20px 26px', fontSize: TYPE.small, fontWeight: 600, color: COLOR.inkSoft}}>
                  {r.k}
                </div>
                {r.v.map((v, ci) => (
                  <div
                    key={ci}
                    style={{
                      padding: '20px 16px',
                      textAlign: 'center',
                      fontSize: TYPE.small,
                      fontWeight: 500,
                      color: COLOR.ink,
                      borderInlineStart: `1px solid ${COLOR.line}`,
                      opacity: ramp(frame, 168 + ri * 105 + ci * 16, 24),
                    }}
                  >
                    {v}
                  </div>
                ))}
              </div>
            );
          })}
        </Card>

        <Lead delay={720} align="center" style={{maxWidth: '64ch', textAlign: 'center', margin: '0 auto'}}>
          اختلفت الوسائط، وبقي السؤال واحدًا: ما الشيء الفيزيائي الذي سنغيّره؟
        </Lead>
      </Col>
    </Scene>
  );
};
