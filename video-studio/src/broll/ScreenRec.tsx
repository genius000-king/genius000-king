// يحوّل تسجيل الشاشة (المسجَّل بـ tools/record-web.mjs) إلى بي-رول مُمَنتج:
// يقصّ المقاطع الميتة، يسرّع التمرير، ويضع أصوات النقر/الكتابة/التمرير على
// لحظاتها الحقيقية من ملف الأحداث — لا تخمين.
import React from "react";
import { OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { Sfx, SfxTrain } from "../sfx/library";

export interface RecData {
  file: string;
  duration: number;
  events: { type: string; t: number }[];
}

export interface Segment {
  from: number; // ثانية داخل التسجيل
  to: number;
  rate?: number;
}

/** طول المقاطع بالفريمات بعد تطبيق السرعة */
export const segmentsFrames = (segs: Segment[], fps: number) =>
  segs.reduce((a, s) => a + Math.round(((s.to - s.from) / (s.rate ?? 1)) * fps), 0);

/** يحوّل زمناً في التسجيل إلى فريم في المونتاج (أو null إن كان في جزء مقصوص) */
export const recTimeToFrame = (t: number, segs: Segment[], fps: number) => {
  let acc = 0;
  for (const s of segs) {
    const r = s.rate ?? 1;
    if (t >= s.from && t <= s.to) return acc + Math.round(((t - s.from) / r) * fps);
    acc += Math.round(((s.to - s.from) / r) * fps);
  }
  return null;
};

export const ScreenRec: React.FC<{ rec: RecData; segments: Segment[]; sfx?: boolean }> = ({ rec, segments, sfx = true }) => {
  const { fps } = useVideoConfig();
  let acc = 0;
  const at = (type: string) =>
    rec.events.filter((e) => e.type === type).map((e) => recTimeToFrame(e.t, segments, fps)).filter((x): x is number => x !== null);
  // صوت التمرير: "درجات" عجلة الفأرة كل ~7 فريمات أثناء فترات التمرير
  const scrollTicks: number[] = [];
  const starts = rec.events.filter((e) => e.type === "scroll_start");
  const ends = rec.events.filter((e) => e.type === "scroll_end");
  starts.forEach((s, i) => {
    const a = recTimeToFrame(s.t, segments, fps);
    const b = recTimeToFrame(ends[i]?.t ?? s.t, segments, fps);
    if (a === null || b === null) return;
    for (let fr = a; fr < b; fr += 7) scrollTicks.push(fr);
  });
  return (
    <>
      {segments.map((s, i) => {
        const r = s.rate ?? 1;
        const len = Math.round(((s.to - s.from) / r) * fps);
        const from = acc;
        acc += len;
        return (
          <Sequence key={i} from={from} durationInFrames={len} layout="none">
            <OffthreadVideo src={staticFile(rec.file)} startFrom={Math.round(s.from * fps)} playbackRate={r} muted
              style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
          </Sequence>
        );
      })}
      {sfx && (
        <>
          <SfxTrain event="screen.click" frames={at("click")} />
          <SfxTrain event="type.key" frames={at("key")} gain={0.8} />
          <SfxTrain event="type.enter" frames={at("enter")} />
          <SfxTrain event="screen.scroll" frames={scrollTicks} gain={0.7} />
        </>
      )}
    </>
  );
};
