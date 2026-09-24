// ═══════════════════════════════════════════════════════════════════
//  قواعد اللغة الصوتية
//  المبدأ: الصوت لا "يوضع" على التايملاين، بل يُولد من الحدث البصري.
//  كل مؤثّر يعرف أين "ذروته": الرايزر ذروته في آخره، الووش في منتصفه،
//  الضربة في أوّلها. نحن نضع الذروة على فريم الحدث — فيتطابق الصوت مع
//  الصورة بدقّة الفريم، وهذا بالضبط الفرق بين مونتاج هاوٍ ومحترف.
// ═══════════════════════════════════════════════════════════════════
import React from "react";
import { Audio, Sequence, random, staticFile, useVideoConfig } from "remotion";
import durations from "./durations.json";

type Anchor = "start" | "middle" | "end" | number; // رقم = ثانية الذروة داخل الملف

interface Layer {
  file: string | string[]; // مصفوفة = تنويعات؛ يُختار منها حتمياً حسب seed (لا تكرار آلي)
  volume: number;
  anchor?: Anchor;
  offset?: number; // ثوانٍ إضافية (سالب = أبكر)
  rate?: [number, number]; // مدى تغيير السرعة/الطبقة عشوائياً — يكسر الرتابة
}

const S = (n: string) => `sfx/synth/${n}.wav`;
const K = (pack: string, n: string) => `sfx/kenney/${pack}/${n}.ogg`;
const range = (f: (i: number) => string, a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => f(a + i));

/**
 * القاموس: اسم الحدث → طبقات الصوت.
 * القاعدة: كل حدث بصري مهم = طبقة "هواء" (قبله) + طبقة "جسم" (عنده) + طبقة "ذيل" (بعده).
 */
export const GRAMMAR = {
  // ─── النصوص ───
  /** عنوان ثقيل يهبط: سحب معكوس ينتهي عنده + ضربة + معدن ثقيل خافت يعطي "ملمساً" */
  "title.slam": [
    { file: S("reverse_swell"), volume: 0.55, anchor: "end" },
    { file: S("impact_cinematic"), volume: 0.9, anchor: "start" },
    { file: range((i) => K("impact-sounds", `impactMetal_heavy_00${i}`), 0, 4), volume: 0.18, anchor: "start" },
  ],
  /** كلمة صغيرة تظهر: نقرة ناعمة + سويش قصير */
  "word.pop": [
    { file: S("swish"), volume: 0.25, anchor: "middle" },
    { file: range((i) => K("ui-audio", `click${i}`), 1, 5), volume: 0.35, anchor: "start", rate: [0.9, 1.15] },
  ],
  /** كلمة مفتاحية مهمّة داخل جملة */
  "word.key": [
    { file: S("pop"), volume: 0.55, anchor: "start", rate: [0.95, 1.05] },
    { file: range((i) => K("interface-sounds", `glass_00${i}`), 1, 6), volume: 0.35, anchor: "start" },
  ],
  /** كتابة بالقلم على الورق — تُمدّ على طول الكتابة */
  "write.pen": [{ file: S("pen_scribble"), volume: 0.7, anchor: "start" }],
  /** ضغطة مفتاح — لكل حرف في الآلة الكاتبة */
  "type.key": [{ file: range((i) => S(`type_key_${i}`), 0, 7), volume: 0.5, anchor: "start", rate: [0.92, 1.1] }],
  "type.enter": [{ file: K("ui-audio", "switch7"), volume: 0.6, anchor: "start" }],
  /** غلتش رقمي */
  glitch: [
    { file: S("glitch"), volume: 0.5, anchor: "start" },
    { file: range((i) => K("interface-sounds", `glitch_00${i}`), 1, 4), volume: 0.35, anchor: "start" },
  ],
  /** كشف أنيق (اقتباس، تعريف): سحب + بريق */
  "reveal.elegant": [
    { file: S("reverse_swell"), volume: 0.35, anchor: "end" },
    { file: S("shimmer"), volume: 0.5, anchor: "start" },
  ],
  /** قلم تحديد فوسفوري يمرّ خلف كلمة */
  "mark.highlight": [{ file: S("paper_slide"), volume: 0.45, anchor: "start", rate: [1.3, 1.5] }],
  /** عدّاد أرقام — نقرة رقمية لكل خطوة */
  "count.tick": [{ file: range((i) => K("interface-sounds", `tick_00${i}`), 1, 2), volume: 0.25, anchor: "start", rate: [0.95, 1.3] }],
  "count.done": [
    { file: K("digital-audio", "threeTone1"), volume: 0.3, anchor: "start" },
    { file: S("pop"), volume: 0.4, anchor: "start" },
  ],

  // ─── الموائع (موضوع خاص) ───
  "fluid.fill": [{ file: S("fluid_flow"), volume: 0.6, anchor: "start" }],
  "fluid.drop": [{ file: S("water_drop"), volume: 0.6, anchor: "start" }],
  "fluid.bubble": [{ file: range((i) => S(`bubble_${i}`), 0, 3), volume: 0.35, anchor: "start", rate: [0.85, 1.25] }],

  // ─── الانتقالات ───
  "transition.whoosh": [{ file: S("whoosh_medium"), volume: 0.6, anchor: "middle" }],
  "transition.whip": [
    { file: S("whoosh_short"), volume: 0.7, anchor: "middle" },
    { file: S("sub_boom"), volume: 0.25, anchor: "start", offset: 0.12 },
  ],
  "transition.paper": [{ file: S("paper_slide"), volume: 0.6, anchor: "middle" }],
  "transition.tapestop": [{ file: S("tape_stop"), volume: 0.5, anchor: "start" }],
  /** بناء توتّر يسبق لحظة كبيرة — ضع الحدث على لحظة الذروة، والرايزر يبدأ قبلها وحده */
  "build.riser": [{ file: S("riser_2s"), volume: 0.55, anchor: "end" }],
  "build.riser.short": [{ file: S("riser_1s"), volume: 0.5, anchor: "end" }],
  drop: [{ file: S("sub_boom"), volume: 0.8, anchor: "start" }],

  // ─── البي-رول ───
  /** شعار يُكشف: رايزر ينتهي عند اللحظة + صب + بريق */
  "logo.reveal": [
    { file: S("riser_1s"), volume: 0.45, anchor: "end" },
    { file: S("sub_boom"), volume: 0.7, anchor: "start" },
    { file: S("shimmer"), volume: 0.35, anchor: "start", offset: 0.05 },
  ],
  "window.open": [
    { file: S("whoosh_short"), volume: 0.45, anchor: "middle" },
    { file: range((i) => K("interface-sounds", `maximize_00${i}`), 1, 9), volume: 0.4, anchor: "start", offset: 0.1 },
  ],
  "window.close": [
    { file: S("whoosh_reverse_dir"), volume: 0.35, anchor: "middle" },
    { file: range((i) => K("interface-sounds", `minimize_00${i}`), 1, 9), volume: 0.4, anchor: "start" },
  ],
  "screen.click": [{ file: [K("ui-audio", "mouseclick1")], volume: 0.7, anchor: "start" }],
  "screen.scroll": [{ file: range((i) => K("interface-sounds", `scroll_00${i}`), 1, 5), volume: 0.35, anchor: "start" }],
  "screen.zoom": [{ file: S("whoosh_short"), volume: 0.3, anchor: "middle", rate: [1.2, 1.4] }],
  "camera.shutter": [{ file: S("camera_shutter"), volume: 0.6, anchor: "start" }],

  // ─── الأجواء ───
  "bed.drone": [{ file: S("drone"), volume: 0.35, anchor: "start" }],
  "bed.hum": [{ file: S("ui_hum"), volume: 0.4, anchor: "start" }],
} satisfies Record<string, Layer[]>;

export type SfxEvent = keyof typeof GRAMMAR;

// ═══════════════════════════════════════════════════════════════════
//  هرم الصوت — ليست كل حركة تستحق صوتاً.
//  1 = لحظة بطولية (عنوان يرتطم، شعار يُكشف): نادرة، ويجب أن تُسمع.
//  2 = لكنة (انتقال، نافذة تُفتح، كلمة مفتاحية): تُنقّط الإيقاع.
//  3 = دقيق (نقرة لكل كلمة، مفتاح لكل حرف، خطوة عدّاد): يكثر، فيصير ضجيجاً.
//  الوضع الافتراضي "balanced" يعزف 1 و2 فقط. الطبقة 3 للمقاطع التي
//  يكون فيها الصوت الدقيق هو الموضوع نفسه (مثل لقطة كتابة مكبّرة).
// ═══════════════════════════════════════════════════════════════════
export const TIER: Record<SfxEvent, 1 | 2 | 3> = {
  "title.slam": 1, "logo.reveal": 1, "build.riser": 1, "build.riser.short": 1, drop: 1, "fluid.fill": 1, "reveal.elegant": 1,
  "transition.whoosh": 2, "transition.whip": 2, "transition.paper": 2, "transition.tapestop": 2,
  "window.open": 2, "window.close": 2, glitch: 2, "word.key": 2, "mark.highlight": 2, "count.done": 2,
  "screen.click": 2, "type.enter": 2, "write.pen": 2, "fluid.drop": 2, "camera.shutter": 2,
  "bed.drone": 1, "bed.hum": 2,
  "word.pop": 3, "type.key": 3, "count.tick": 3, "screen.scroll": 3, "screen.zoom": 3, "fluid.bubble": 3,
};

export type Density = "minimal" | "balanced" | "rich";
const MAX_TIER: Record<Density, number> = { minimal: 1, balanced: 2, rich: 3 };
export const SfxDensity = React.createContext<Density>("balanced");

const dur = (f: string) => (durations as Record<string, number>)[f] ?? 1;

const anchorSec = (a: Anchor | undefined, len: number) =>
  a === "end" ? len : a === "middle" ? len / 2 : typeof a === "number" ? a : 0;

/**
 * <Sfx event="title.slam" at={45} />
 * `at` = فريم الحدث البصري (ذروة الصوت تقع عليه). `seed` يغيّر التنويعة.
 * `gain` يضرب كل الطبقات. `stretch` لتمديد صوت بطول حدث (مثل الكتابة).
 */
export const Sfx: React.FC<{ event: SfxEvent; at: number; seed?: string | number; gain?: number; maxDur?: number }> = ({
  event,
  at,
  seed = 0,
  gain = 1,
  maxDur,
}) => {
  const { fps } = useVideoConfig();
  const density = React.useContext(SfxDensity);
  if (TIER[event] > MAX_TIER[density]) return null;
  const layers = GRAMMAR[event] as Layer[];
  return (
    <>
      {layers.map((l, i) => {
        const files = Array.isArray(l.file) ? l.file : [l.file];
        const file = files[Math.floor(random(`${event}-${seed}-${i}`) * files.length)];
        const rate = l.rate ? l.rate[0] + random(`${event}-${seed}-${i}-r`) * (l.rate[1] - l.rate[0]) : 1;
        const len = dur(file) / rate;
        const startSec = at / fps - anchorSec(l.anchor, len) + (l.offset ?? 0);
        let from = Math.round(startSec * fps);
        let trim = 0;
        if (from < 0) { trim = -from; from = 0; } // حدث قرب البداية: نقصّ رأس الصوت بدل أن نفقده
        const lenFrames = Math.ceil(len * fps) - trim;
        const d = maxDur ? Math.min(lenFrames, maxDur) : lenFrames;
        if (d <= 0) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={d} layout="none" name={`♪ ${event}`}>
            <Audio
              src={staticFile(file)}
              startFrom={Math.round(trim * rate)}
              playbackRate={rate}
              volume={(f) => {
                // تلاشٍ قصير في آخر مقطع مقصوص كي لا يُسمع "قطع"
                const tail = maxDur && lenFrames > maxDur ? Math.min(1, (d - f) / 6) : 1;
                return l.volume * gain * tail;
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};

/** سلسلة أحداث من نفس النوع (ضغطات مفاتيح، فقاعات، نقرات عدّاد) */
/** سلسلة أحداث من نفس النوع (ضغطات مفاتيح، نقرات عدّاد).
 *  `minGap` يمنع "الرشّاش": لا صوتان أقرب من هذا (بالفريمات) — الأذن تسمع
 *  الإيقاع لا كل نبضة، فنصف النبضات يكفي لإيهامها بالكل. */
export const SfxTrain: React.FC<{ event: SfxEvent; frames: number[]; gain?: number; minGap?: number }> = ({ event, frames, gain, minGap = 5 }) => {
  const kept: number[] = [];
  for (const f of [...frames].sort((a, b) => a - b)) if (!kept.length || f - kept[kept.length - 1] >= minGap) kept.push(f);
  return (
    <>
      {kept.map((f, i) => (
        <Sfx key={i} event={event} at={f} seed={i} gain={gain} />
      ))}
    </>
  );
};
