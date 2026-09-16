import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {enter, ramp} from '../design/motion';
import {makeRng, range} from '../design/rng';
import {Scene, Statement, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card, Panel} from '../components/Card';
import {Callout} from '../components/Magnetics';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/* =================================================================== */
/* S1 — 6:55 Board → chip → die layers → one cell.                      */
/* =================================================================== */

export const SceneSsdZoom: React.FC = () => {
  const frame = useCurrentFrame();

  const board = ramp(frame, 8, 40);
  const layers = ramp(frame, 240, 56);
  const cell = ramp(frame, 480, 56);

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1600, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>الحالة الصلبة</Kicker>
          <Title delay={10} size={TYPE.h2}>لا مغناطيس ولا ضوء — كهرباء</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: SPACE.lg, alignItems: 'center'}}>
          {/* 1. The board */}
          <svg viewBox="0 0 360 230" style={{width: '100%', opacity: board}}>
            <rect x={6} y={30} width={348} height={170} rx={10} fill="#1F3A2E" opacity={0.92} />
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={26 + (i % 2) * 168}
                y={54 + Math.floor(i / 2) * 78}
                width={140}
                height={58}
                rx={6}
                fill={COLOR.ink}
                opacity={ramp(frame, 30 + i * 8, 20)}
              />
            ))}
            <rect x={110} y={126} width={140} height={58} rx={6} fill={COLOR.charge} opacity={0.0} />
            <text x={180} y={218} textAnchor="middle" fontFamily={FONT.sans} fontSize={20} fill={COLOR.inkMute} direction="rtl">
              رقاقات على لوحة
            </text>
          </svg>

          {/* 2. The die: stacked layers */}
          <svg viewBox="0 0 360 230" style={{width: '100%', opacity: layers}}>
            {range(6).map((i) => (
              <g key={i} opacity={ramp(frame, 250 + i * 9, 22)}>
                <path
                  d={`M60 ${170 - i * 22} L300 ${170 - i * 22} L262 ${192 - i * 22} L22 ${192 - i * 22} Z`}
                  fill={i === 3 ? COLOR.charge : '#D4CFC5'}
                  opacity={i === 3 ? 0.85 : 1}
                  stroke={COLOR.inkFaint}
                  strokeWidth={1}
                />
              </g>
            ))}
            <text x={180} y={218} textAnchor="middle" fontFamily={FONT.sans} fontSize={20} fill={COLOR.inkMute} direction="rtl">
              طبقات داخل الرقاقة
            </text>
          </svg>

          {/* 3. The cell grid, then one cell pulled out */}
          <svg viewBox="0 0 360 230" style={{width: '100%', opacity: cell}}>
            {range(7).map((r) =>
              range(11).map((c) => {
                const on = ramp(frame, 490 + ((r * 11 + c) % 30) * 2, 16);
                const lit = (r * 7 + c * 3) % 5 === 0;
                return (
                  <rect
                    key={`${r}-${c}`}
                    x={22 + c * 30}
                    y={28 + r * 22}
                    width={22}
                    height={15}
                    rx={3}
                    fill={lit ? COLOR.charge : 'rgba(22,34,46,0.10)'}
                    opacity={on}
                  />
                );
              })
            )}
            <rect x={20} y={26} width={324} height={160} rx={8} fill="none" stroke={COLOR.line} />
            <text x={180} y={218} textAnchor="middle" fontFamily={FONT.sans} fontSize={20} fill={COLOR.inkMute} direction="rtl">
              مليارات الخلايا
            </text>
          </svg>
        </div>

        <Row gap={SPACE.md} style={{justifyContent: 'center'}}>
          <Lead delay={520} align="center" style={{maxWidth: '60ch', textAlign: 'center'}}>
            <Mono>NVMe</Mono> أو <Mono>SATA</Mono> أو <Mono>USB</Mono> — كلها تنتهي
            عند الشيء نفسه: خلية تحبس شحنة.
          </Lead>
        </Row>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* S2 — 7:24 The cell. Empty is 1. This surprises people.               */
/* =================================================================== */

const ELECTRONS = (() => {
  const rng = makeRng(4211);
  return range(26).map(() => ({x: rng(), y: rng(), ph: rng() * 6.28}));
})();

const FloatingGate: React.FC<{charge: number; label?: string; scale?: number}> = ({
  charge,
  label,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <g transform={`scale(${scale})`}>
      {/* Control gate */}
      <rect x={0} y={0} width={280} height={34} rx={6} fill={COLOR.inkSoft} />
      <text x={140} y={23} textAnchor="middle" fontFamily={FONT.mono} fontSize={16} fill="#fff">CONTROL GATE</text>
      {/* Oxide */}
      <rect x={0} y={38} width={280} height={14} fill="rgba(22,34,46,0.12)" />
      {/* Floating gate — the trap */}
      <rect
        x={0}
        y={56}
        width={280}
        height={62}
        rx={5}
        fill={COLOR.charge}
        opacity={0.10 + 0.34 * charge}
        stroke={COLOR.charge}
        strokeWidth={2.5}
      />
      {ELECTRONS.map((e, i) => {
        const vis = i / ELECTRONS.length < charge ? 1 : 0;
        const bob = Math.sin(frame / 14 + e.ph) * 2.2;
        return (
          <circle
            key={i}
            cx={16 + e.x * 248}
            cy={66 + e.y * 42 + bob}
            r={5}
            fill={COLOR.charge}
            opacity={vis}
          />
        );
      })}
      <rect x={0} y={122} width={280} height={14} fill="rgba(22,34,46,0.12)" />
      {/* Channel */}
      <rect x={0} y={140} width={280} height={40} rx={5} fill="#D6D1C7" stroke={COLOR.inkFaint} />
      <text x={140} y={166} textAnchor="middle" fontFamily={FONT.mono} fontSize={16} fill={COLOR.inkSoft}>CHANNEL</text>
      {label ? (
        <text x={140} y={210} textAnchor="middle" fontFamily={FONT.sans} fontSize={22} fontWeight={600} fill={COLOR.ink} direction="rtl">
          {label}
        </text>
      ) : null}
    </g>
  );
};

export const SceneSsdCell: React.FC = () => {
  const frame = useCurrentFrame();
  const left = ramp(frame, 20, 40);
  const right = ramp(frame, 260, 40);
  const verdict = ramp(frame, 470, 44);

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1500, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>الخلية</Kicker>
          <Title delay={10} size={TYPE.h2}>فارغة تساوي واحدًا. ليست صفرًا.</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.xl}}>
          <Panel
            title="فارغة"
            delay={20}
            badge={<Chip delay={40} color={COLOR.inkSoft} solid size={TYPE.h3}><Mono>1</Mono></Chip>}
          >
            <svg viewBox="-10 -10 300 230" style={{width: '100%', opacity: left}}>
              <FloatingGate charge={0} />
            </svg>
            <Lead delay={60} size={TYPE.small} style={{maxWidth: 'none', marginTop: SPACE.sm}}>
              لا شحنات محبوسة. هذه هي حالة المسح.
            </Lead>
          </Panel>

          <Panel
            title="مشحونة"
            delay={260}
            badge={<Chip delay={280} color={COLOR.charge} solid size={TYPE.h3}><Mono>0</Mono></Chip>}
          >
            <svg viewBox="-10 -10 300 230" style={{width: '100%', opacity: right}}>
              <FloatingGate charge={ramp(frame, 300, 60)} />
            </svg>
            <Lead delay={300} size={TYPE.small} style={{maxWidth: 'none', marginTop: SPACE.sm}}>
              إلكترونات محبوسة في بوابة عائمة — معزولة من كل الجهات.
            </Lead>
          </Panel>
        </div>

        <Card delay={470} pad={SPACE.lg} accent={COLOR.charge} style={{opacity: verdict}}>
          <Lead delay={480} align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.5}}>
            ما يُخزَّن ليس الرقم — بل <strong style={{color: COLOR.charge}}>وجود الشحنة أو غيابها</strong>.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* S3 — 7:47 Counting the charge: one cell, three bits.                 */
/* =================================================================== */

const TIERS = [
  {n: 'SLC', bits: 1, levels: 2, color: COLOR.good, note: 'الأسرع والأطول عمرًا'},
  {n: 'MLC', bits: 2, levels: 4, color: COLOR.navy, note: 'توازن'},
  {n: 'TLC', bits: 3, levels: 8, color: COLOR.amber, note: 'الأرخص والأكثف'},
];

export const SceneSsdLevels: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1560, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>الترقية</Kicker>
          <Title delay={10} size={TYPE.h2}>لا تسأل «هل فيها شحنة» — بل «كم فيها»</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: SPACE.lg}}>
          {TIERS.map((t, i) => {
            const on = ramp(frame, 60 + i * 70, 44);
            return (
              <Panel
                key={t.n}
                delay={60 + i * 70}
                title={<Mono style={{color: t.color, fontSize: TYPE.h3}}>{t.n}</Mono>}
                badge={<Chip delay={70 + i * 70} color={t.color} solid>{t.bits} بت / خلية</Chip>}
              >
                {/* A voltage ladder. More rungs in the same window is exactly
                    why denser flash is more fragile. */}
                <svg viewBox="0 0 300 190" style={{width: '100%'}}>
                  <rect x={40} y={8} width={220} height={166} rx={8} fill="rgba(22,34,46,0.03)" stroke={COLOR.line} />
                  {range(t.levels).map((l) => {
                    const y = 168 - (l + 0.5) * (160 / t.levels);
                    const rung = ramp(frame, 80 + i * 70 + l * 6, 18);
                    return (
                      <g key={l} opacity={rung}>
                        <line x1={48} y1={y} x2={252} y2={y} stroke={t.color} strokeWidth={3} strokeLinecap="round" />
                        <text
                          x={264}
                          y={y + 5}
                          fontFamily={FONT.mono}
                          fontSize={13}
                          fill={COLOR.inkMute}
                        >
                          {l.toString(2).padStart(t.bits, '0')}
                        </text>
                      </g>
                    );
                  })}
                  <text x={26} y={96} textAnchor="middle" fontFamily={FONT.sans} fontSize={16} fill={COLOR.inkMute} transform="rotate(-90 26 96)" direction="rtl">
                    الجهد
                  </text>
                </svg>
                <span style={{fontSize: TYPE.label, color: COLOR.inkMute}}>{t.note}</span>
              </Panel>
            );
          })}
        </div>

        <Lead delay={300} align="center" style={{maxWidth: '64ch', textAlign: 'center', margin: '0 auto'}}>
          نفس المساحة، ثلاثة أضعاف السعة — مقابل هامش خطأ أضيق بثمانية أضعاف.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* S4 — 8:02 Why solid state wins: nothing moves.                       */
/* =================================================================== */

export const SceneNoMovingParts: React.FC = () => {
  const frame = useCurrentFrame();
  const spin = frame * 3;
  const reveal = ramp(frame, 220, 50);

  return (
    <Scene>
      <Col gap={SPACE.xl} style={{flex: 1, justifyContent: 'center', maxWidth: 1500, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>السبب الحقيقي للسرعة</Kicker>
          <Title delay={10} size={TYPE.h2}>لا شيء يتحرك</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.xl, alignItems: 'center'}}>
          <Panel title="قرص صلب / قرص ضوئي" delay={20} badge={<Chip delay={40} color={COLOR.north}>حركة فيزيائية</Chip>}>
            <svg viewBox="-150 -150 300 300" style={{width: '100%', maxHeight: 300}}>
              <ellipse cx={0} cy={0} rx={120} ry={120} fill="#E4E0D7" stroke={COLOR.inkFaint} />
              <g transform={`rotate(${spin})`}>
                <line x1={0} y1={0} x2={0} y2={-108} stroke={COLOR.north} strokeWidth={5} strokeLinecap="round" />
              </g>
              <circle cx={0} cy={0} r={18} fill={COLOR.ink} />
              <g transform={`rotate(${-28 + Math.sin(frame / 22) * 14})`}>
                <rect x={-6} y={-150} width={12} height={92} rx={6} fill={COLOR.inkSoft} />
              </g>
              <text x={0} y={140} textAnchor="middle" fontFamily={FONT.sans} fontSize={22} fontWeight={600} fill={COLOR.north} direction="rtl">
                انتظر حتى يصل المكان
              </text>
            </svg>
          </Panel>

          <Panel title="ذاكرة صلبة" delay={220} badge={<Chip delay={240} color={COLOR.charge} solid>كهرباء فقط</Chip>}>
            <svg viewBox="-150 -150 300 300" style={{width: '100%', maxHeight: 300}}>
              {range(6).map((r) =>
                range(6).map((c) => {
                  const hit = (r * 6 + c) % 7 === Math.floor(frame / 8) % 7;
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={-132 + c * 44}
                      y={-120 + r * 40}
                      width={34}
                      height={30}
                      rx={5}
                      fill={hit ? COLOR.charge : 'rgba(22,34,46,0.08)'}
                      opacity={reveal}
                    />
                  );
                })
              )}
              <text x={0} y={140} textAnchor="middle" fontFamily={FONT.sans} fontSize={22} fontWeight={600} fill={COLOR.charge} direction="rtl" opacity={reveal}>
                اذهب إلى أي خلية فورًا
              </text>
            </svg>
          </Panel>
        </div>

        <Lead delay={320} align="center" style={{maxWidth: '62ch', textAlign: 'center', margin: '0 auto'}}>
          القرص الصلب يحتاج أن يدور المكان تحت الإبرة. الذاكرة الصلبة لا تنتظر شيئًا.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* S5 — 8:28 Write, erase, and the hidden cost of all this.             */
/* =================================================================== */

export const SceneSsdWriteErase: React.FC = () => {
  const frame = useCurrentFrame();
  const write = interpolate(frame, [60, 240], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez});
  const erase = interpolate(frame, [340, 480], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: bez});
  const charge = frame < 300 ? write : erase;
  const complexity = ramp(frame, 540, 46);

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1540, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>الكتابة والمسح</Kicker>
            <Title delay={10} size={TYPE.h2}>
              {frame < 300 ? 'ادفع الإلكترونات للداخل' : 'اسحبها للخارج'}
            </Title>
          </Col>
          <Chip delay={20} color={frame < 300 ? COLOR.charge : COLOR.amber} solid size={TYPE.h3}>
            {frame < 300 ? 'كتابة' : 'مسح'}
          </Chip>
        </Row>

        <Row gap={SPACE.xl} style={{justifyContent: 'center', alignItems: 'center'}}>
          <svg viewBox="-20 -20 320 240" style={{width: 460}}>
            <FloatingGate charge={charge} />
            {/* Arrows show the direction electrons are being forced. */}
            {range(4).map((i) => {
              const dir = frame < 300 ? 1 : -1;
              const p = ((frame / 3 + i * 9) % 36) / 36;
              const y = dir > 0 ? 140 - p * 60 : 80 + p * 60;
              return (
                <circle key={i} cx={40 + i * 66} cy={y} r={5} fill={COLOR.charge} opacity={0.55} />
              );
            })}
          </svg>

          <Col gap={SPACE.md} style={{maxWidth: 560}}>
            <Lead delay={30}>
              الفكرة أبسط ما يكون: لتكتب، احبس شحنة. لتمسح، أفرغها.
              وتبقى محبوسة سنوات بلا كهرباء.
            </Lead>
            <Card delay={540} pad={SPACE.md} accent={COLOR.amber} style={{opacity: complexity}}>
              <Col gap={6}>
                <span style={{fontSize: TYPE.label, fontWeight: 700, color: COLOR.amber}}>الثمن المخفي</span>
                <Lead delay={550} size={TYPE.small} style={{maxWidth: 'none'}}>
                  الفكرة هي الأسهل — والتطبيق هو الأصعب. كل كتابة تُتعب العزل قليلًا،
                  فيحتاج القرص متحكّمًا كاملًا يوازن التآكل ويخفي الخلايا الميتة.
                </Lead>
              </Col>
            </Card>
          </Col>
        </Row>
      </Col>
    </Scene>
  );
};
