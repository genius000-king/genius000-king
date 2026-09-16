import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import {COLOR, EASE, FONT, SPACE, TYPE} from '../design/tokens';
import {enter, ramp} from '../design/motion';
import {Scene, Statement, Col, Row} from '../components/Layout';
import {Chip, Kicker, Lead, Mono, Title} from '../components/Type';
import {Card, Panel} from '../components/Card';
import {Callout, Measure} from '../components/Magnetics';

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/** The track: 1 = pit, 0 = land. Chosen so the read-out has a pleasing rhythm. */
const TRACK = [0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1];
const SEG = 78;
const PIT_D = 30;

/* =================================================================== */
/* O1 — 3:49 What the surface actually looks like.                      */
/* =================================================================== */

export const SceneOpticalSurface: React.FC = () => {
  const frame = useCurrentFrame();
  const micro = ramp(frame, 10, 44);
  const flatten = ramp(frame, 330, 60);
  const labels = ramp(frame, 480, 44);

  // Phase 1 is an oblique 3D-ish view; phase 2 rotates it flat to a section.
  const tilt = (1 - flatten) * 22;
  const squash = 1 - flatten * 0.55;

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1580, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>تحت المجهر</Kicker>
            <Title delay={10} size={TYPE.h2}>لا مغناطيس. حفر ومساحات.</Title>
          </Col>
          <Row gap={SPACE.sm}>
            <Chip delay={470} color={COLOR.inkSoft}>مسطّح — Land</Chip>
            <Chip delay={480} color={COLOR.laser} solid>حفرة — Pit</Chip>
          </Row>
        </Row>

        <svg viewBox="-40 -190 1060 360" style={{width: '100%', display: 'block', maxHeight: 560, margin: '0 auto'}}>
          <g transform={`translate(0, ${tilt}) scale(1, ${squash})`} opacity={micro}>
            {/* One continuous surface profile — pits are depressions in it, not
                separate objects sitting on top. */}
            <path
              d={(() => {
                let d = `M0 0`;
                TRACK.forEach((v, i) => {
                  const x0 = i * SEG;
                  const x1 = x0 + SEG;
                  if (v === 1) {
                    d += ` L${x0 + 8} 0 L${x0 + 16} ${PIT_D} L${x1 - 16} ${PIT_D} L${x1 - 8} 0`;
                  } else {
                    d += ` L${x1} 0`;
                  }
                });
                d += ` L${TRACK.length * SEG} 70 L0 70 Z`;
                return d;
              })()}
              fill="#DED9D0"
              stroke={COLOR.inkSoft}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {TRACK.map((v, i) =>
              v === 1 ? (
                <rect
                  key={i}
                  x={i * SEG + 16}
                  y={2}
                  width={SEG - 32}
                  height={PIT_D - 2}
                  fill={COLOR.laser}
                  opacity={0.16}
                />
              ) : null
            )}
          </g>

          <Measure
            x={0}
            y={132}
            width={TRACK.length * SEG}
            label="مسار واحد من ملايين المسارات"
            on={labels}
            color={COLOR.inkMute}
          />

          <Callout
            from={[2 * SEG + SEG / 2, PIT_D]}
            to={[2 * SEG - 80, -118]}
            label="عمق الحفرة"
            sub="ربع طول الموجة"
            on={labels}
            color={COLOR.laser}
            anchor="middle"
          />
        </svg>

        <Lead delay={500} align="center" style={{maxWidth: '58ch', textAlign: 'center', margin: '0 auto'}}>
          نفس فكرة القرص الصلب تمامًا — لكن بدل المغناطيس، ضوء.
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* O2 — 4:15 The laser. Including the bit the script gets tangled in.   */
/* =================================================================== */

export const SceneLaserRead: React.FC = () => {
  const frame = useCurrentFrame();

  const rig = ramp(frame, 10, 40);
  const SWEEP = 330;
  const LEN = 620;
  const sweepT = interpolate(frame, [SWEEP, SWEEP + LEN], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.linear,
  });
  const idx = Math.min(TRACK.length - 1, Math.floor(sweepT * TRACK.length));
  const laserX = sweepT * (TRACK.length * SEG);
  const inPit = TRACK[idx] === 1;
  const physics = ramp(frame, 1000, 50);

  return (
    <Scene>
      <Col gap={SPACE.md} style={{flex: 1, justifyContent: 'center', maxWidth: 1580, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>القراءة بالليزر</Kicker>
            <Title delay={10} size={TYPE.h2}>
              {frame > SWEEP && inPit ? 'حفرة ← الضوء لا يعود' : 'مسطّح ← الضوء ينعكس'}
            </Title>
          </Col>
          <Row gap={SPACE.sm} style={{opacity: rig}}>
            <Chip delay={20} color={COLOR.laser} solid>باعث + مستقبِل</Chip>
          </Row>
        </Row>

        <svg viewBox="-40 -330 1060 430" style={{width: '100%', display: 'block', maxHeight: 620, margin: '0 auto'}}>
          {/* Surface */}
          <path
            d={(() => {
              let d = `M0 0`;
              TRACK.forEach((v, i) => {
                const x0 = i * SEG;
                const x1 = x0 + SEG;
                if (v === 1) d += ` L${x0 + 8} 0 L${x0 + 16} ${PIT_D} L${x1 - 16} ${PIT_D} L${x1 - 8} 0`;
                else d += ` L${x1} 0`;
              });
              d += ` L${TRACK.length * SEG} 62 L0 62 Z`;
              return d;
            })()}
            fill="#DED9D0"
            stroke={COLOR.inkSoft}
            strokeWidth={2}
            strokeLinejoin="round"
            opacity={rig}
          />
          {/* The mirror finish that makes reflection possible at all. */}
          <rect x={0} y={-4} width={TRACK.length * SEG} height={5} fill="#BFD3E6" opacity={0.85 * rig} />

          {frame > SWEEP - 20 ? (
            <g>
              {/* Incident beam */}
              <line x1={laserX - 74} y1={-250} x2={laserX} y2={inPit ? PIT_D : 0} stroke={COLOR.laser} strokeWidth={4} opacity={0.9} strokeLinecap="round" />
              {/* Reflected beam — full on a land, cancelled over a pit. */}
              <line
                x1={laserX}
                y1={inPit ? PIT_D : 0}
                x2={laserX + 74}
                y2={-250}
                stroke={COLOR.laser}
                strokeWidth={4}
                opacity={inPit ? 0.13 : 0.9}
                strokeLinecap="round"
                strokeDasharray={inPit ? '8 10' : undefined}
              />
              <circle cx={laserX} cy={inPit ? PIT_D : 0} r={inPit ? 6 : 13} fill={COLOR.laser} opacity={inPit ? 0.35 : 0.95} />

              {/* Emitter / detector housing */}
              <g transform={`translate(${laserX - 118}, -300)`}>
                <rect x={0} y={0} width={88} height={48} rx={10} fill={COLOR.ink} />
                <text x={44} y={30} textAnchor="middle" fontFamily={FONT.mono} fontSize={17} fill="#fff">LASER</text>
              </g>
              <g transform={`translate(${laserX + 30}, -300)`}>
                <rect x={0} y={0} width={88} height={48} rx={10} fill={inPit ? COLOR.inkSoft : COLOR.good} />
                <text x={44} y={30} textAnchor="middle" fontFamily={FONT.mono} fontSize={17} fill="#fff">
                  {inPit ? '0' : '1'}
                </text>
              </g>
            </g>
          ) : null}
        </svg>

        {/* The upgrade to his explanation. He says the pit "blocks" the light;
            it does not — the returning wave is half a wavelength out of step
            with its neighbours and the two cancel. */}
        <Card delay={1000} pad={SPACE.lg} accent={COLOR.laser} style={{opacity: physics}}>
          <Row gap={SPACE.lg} style={{justifyContent: 'space-between', alignItems: 'center'}}>
            <Col gap={SPACE.xs} style={{flex: 1}}>
              <span style={{fontSize: TYPE.small, fontWeight: 700, color: COLOR.laser}}>
                لماذا لا يعود الضوء من الحفرة؟
              </span>
              <Lead delay={1010} size={TYPE.small} style={{maxWidth: 'none'}}>
                ليس لأنها «تحجبه». عمق الحفرة يساوي <Mono>λ/4</Mono>، فيقطع الضوء
                مسافة إضافية مقدارها <Mono>λ/2</Mono> ذهابًا وإيابًا — فيعود
                معاكسًا لموجة جاره تمامًا، والموجتان تلغيان بعضهما.
              </Lead>
            </Col>
            <Chip delay={1030} color={COLOR.laser} solid size={TYPE.small}>تداخل هدّام</Chip>
          </Row>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* O3 — 4:56 Scale: millions of these, and the family of formats.       */
/* =================================================================== */

const FORMATS = [
  {name: 'CD', wave: '780 nm', cap: '٧٠٠ ميغابايت', layers: 'طبقة واحدة', color: COLOR.inkMute},
  {name: 'DVD', wave: '650 nm', cap: '٤٫٧ غيغابايت', layers: 'طبقة أو طبقتان', color: COLOR.navy},
  {name: 'Blu-ray', wave: '405 nm', cap: '٢٥ غيغابايت', layers: 'حتى أربع طبقات', color: COLOR.south},
];

export const SceneOpticalScale: React.FC = () => {
  const frame = useCurrentFrame();
  const zoomOut = ramp(frame, 20, 70);
  const cards = 420;

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1580, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>المقياس</Kicker>
          <Title delay={10} size={TYPE.h2}>موجة أقصر ← حفرة أصغر ← سعة أكبر</Title>
        </Col>

        {/* Three tracks at the same width, at three pit densities. The argument
            is made by the drawing, not by the numbers underneath it. */}
        <svg viewBox="0 -10 1000 250" style={{width: '100%', display: 'block'}}>
          {FORMATS.map((f, row) => {
            const density = [12, 22, 40][row];
            const on = ramp(frame, 60 + row * 50, 46);
            const w = 1000 / density;
            return (
              <g key={f.name} transform={`translate(0, ${row * 82})`} opacity={on}>
                <rect x={0} y={0} width={1000} height={44} rx={8} fill="#E4E0D7" stroke={COLOR.line} />
                {Array.from({length: density}).map((_, i) =>
                  (i * 7) % 3 !== 0 ? null : (
                    <rect
                      key={i}
                      x={i * w + w * 0.2}
                      y={10}
                      width={w * 0.6}
                      height={24}
                      rx={4}
                      fill={f.color}
                      opacity={0.75 * zoomOut}
                    />
                  )
                )}
                <text
                  x={-16}
                  y={28}
                  textAnchor="end"
                  fontFamily={FONT.mono}
                  fontSize={20}
                  fontWeight={600}
                  fill={f.color}
                >
                  {f.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: SPACE.md}}>
          {FORMATS.map((f, i) => (
            <Panel
              key={f.name}
              delay={cards + i * 14}
              title={<Mono style={{color: f.color}}>{f.name}</Mono>}
              badge={<Chip delay={cards + i * 14 + 6} color={f.color}><Mono>{f.wave}</Mono></Chip>}
              pad={SPACE.md}
            >
              <Col gap={6}>
                <span style={{fontSize: TYPE.small, fontWeight: 600}}>{f.cap}</span>
                <span style={{fontSize: TYPE.label, color: COLOR.inkMute}}>{f.layers}</span>
              </Col>
            </Panel>
          ))}
        </div>

        <Lead delay={cards + 80} align="center" style={{maxWidth: '62ch', textAlign: 'center', margin: '0 auto'}}>
          الفكرة واحدة في كلها: هل انعكس الضوء أم لا؟
        </Lead>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* O4 — 5:31 Deleting on optical media: three different answers.        */
/* =================================================================== */

const MEDIA = [
  {
    name: 'CD-ROM',
    what: 'حفر محفورة فيزيائيًا',
    del: 'مستحيل',
    color: COLOR.inkMute,
    tone: 'محمي للأبد',
  },
  {
    name: 'CD-R',
    what: 'صبغة تتغيّر بالحرارة',
    del: 'مرة واحدة فقط',
    color: COLOR.amber,
    tone: 'يُكتب مرة',
  },
  {
    name: 'CD-RW / DVD-RW',
    what: 'سبيكة تتبدّل بين بلّوري وزجاجي',
    del: 'يُعاد استخدامها',
    color: COLOR.good,
    tone: 'قابل للمسح',
  },
];

export const SceneOpticalDelete: React.FC = () => {
  const frame = useCurrentFrame();
  const verdict = ramp(frame, 900, 44);

  return (
    <Scene>
      <Col gap={SPACE.lg} style={{flex: 1, justifyContent: 'center', maxWidth: 1620, margin: '0 auto', width: '100%'}}>
        <Col gap={SPACE.sm}>
          <Kicker delay={4}>الحذف</Kicker>
          <Title delay={10} size={TYPE.h2}>ثلاثة أقراص، ثلاث إجابات مختلفة</Title>
        </Col>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: SPACE.md}}>
          {MEDIA.map((m, i) => (
            <Panel
              key={m.name}
              delay={120 + i * 40}
              title={<Mono style={{fontSize: TYPE.h3, color: m.color}}>{m.name}</Mono>}
              badge={<Chip delay={130 + i * 40} color={m.color} solid>{m.tone}</Chip>}
            >
              <Col gap={SPACE.md}>
                <Col gap={4}>
                  <span style={{fontSize: TYPE.label, color: COLOR.inkMute}}>ما الذي يتغيّر</span>
                  <span style={{fontSize: TYPE.small, fontWeight: 500, lineHeight: 1.5}}>{m.what}</span>
                </Col>
                <div style={{height: 1, background: COLOR.line}} />
                <Col gap={4}>
                  <span style={{fontSize: TYPE.label, color: COLOR.inkMute}}>الحذف</span>
                  <span style={{fontSize: TYPE.small, fontWeight: 700, color: m.color}}>{m.del}</span>
                </Col>
              </Col>
            </Panel>
          ))}
        </div>

        <Card delay={900} pad={SPACE.lg} accent={COLOR.danger} style={{opacity: verdict}}>
          <Lead delay={910} align="center" style={{maxWidth: 'none', textAlign: 'center', fontSize: TYPE.h3, color: COLOR.ink, lineHeight: 1.5}}>
            وحتى حين يقول لك القرص «حذفت الملف» — الحالة الفيزيائية للسطح
            <strong style={{color: COLOR.danger}}> لم تتغيّر</strong>. تمامًا كالقرص الصلب.
          </Lead>
        </Card>
      </Col>
    </Scene>
  );
};

/* =================================================================== */
/* O5 — 6:15 Burning: the laser stops reading and starts changing.      */
/* =================================================================== */

export const SceneBurner: React.FC = () => {
  const frame = useCurrentFrame();
  const BURN = 220;
  const t = interpolate(frame, [BURN, BURN + 620], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.linear,
  });
  const burned = t * TRACK.length;
  const x = t * (TRACK.length * SEG);
  const power = ramp(frame, 120, 50);

  return (
    <Scene>
      <Col gap={SPACE.md} style={{flex: 1, justifyContent: 'center', maxWidth: 1580, margin: '0 auto', width: '100%'}}>
        <Row style={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <Col gap={SPACE.sm}>
            <Kicker delay={4}>الكتابة</Kicker>
            <Title delay={10} size={TYPE.h2}>نفس الليزر. طاقة أعلى.</Title>
          </Col>
          <Row gap={SPACE.sm} style={{opacity: power}}>
            <Chip delay={130} color={COLOR.inkMute}>قراءة — ٥ مللي واط</Chip>
            <Chip delay={140} color={COLOR.laser} solid>حرق — ١٠٠ مللي واط</Chip>
          </Row>
        </Row>

        <svg viewBox="-40 -300 1060 400" style={{width: '100%', display: 'block', maxHeight: 600, margin: '0 auto'}}>
          {/* A blank disc: perfectly flat until the burner touches it. */}
          <rect x={0} y={0} width={TRACK.length * SEG} height={62} fill="#DED9D0" stroke={COLOR.inkSoft} strokeWidth={2} rx={4} />
          <rect x={0} y={-4} width={TRACK.length * SEG} height={5} fill="#BFD3E6" opacity={0.85} />

          {TRACK.map((v, i) => {
            if (v !== 1) return null;
            const done = burned > i + 0.6;
            return (
              <rect
                key={i}
                x={i * SEG + 16}
                y={2}
                width={SEG - 32}
                height={PIT_D}
                rx={3}
                fill={COLOR.ink}
                opacity={done ? 0.85 : 0}
              />
            );
          })}

          {frame > BURN - 20 ? (
            <g>
              <line x1={x} y1={-230} x2={x} y2={0} stroke={COLOR.laser} strokeWidth={7} opacity={0.95} strokeLinecap="round" />
              <circle cx={x} cy={0} r={22} fill={COLOR.laser} opacity={0.30} />
              <circle cx={x} cy={0} r={11} fill={COLOR.laser} />
              <g transform={`translate(${x - 58}, -282)`}>
                <rect x={0} y={0} width={116} height={50} rx={10} fill={COLOR.laser} />
                <text x={58} y={32} textAnchor="middle" fontFamily={FONT.mono} fontSize={17} fill="#fff">BURNER</text>
              </g>
            </g>
          ) : null}
        </svg>

        <Lead delay={30} align="center" style={{maxWidth: '62ch', textAlign: 'center', margin: '0 auto'}}>
          قرص فارغ = سطح مسطّح بالكامل. الليزر الحارق يصنع الحفر بنفسه —
          وهكذا تُكتب معلومة لم تكن موجودة.
        </Lead>
      </Col>
    </Scene>
  );
};
