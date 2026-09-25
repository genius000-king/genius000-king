// تسجيل شاشة جاهز للمشهد: يختار المقاطع المفيدة تلقائياً من ملف الأحداث
// ويضبط السرعة لتملأ طول المشهد بالضبط، ويقرّب على خانة البحث وقت الكتابة.
import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { MacWindow, ZoomKey } from "../broll/MacWindow";
import { RecData, ScreenRec, Segment, recTimeToFrame, segmentsFrames } from "../broll/ScreenRec";

const ENTER = 18; // فريمات دخول النافذة قبل بدء التسجيل

export const autoSegments = (rec: RecData, frames: number, fps: number, from?: number): Segment[] => {
  const ev = (t: string) => rec.events.filter((e) => e.type === t);
  const avail = (frames - ENTER - 16) / fps; // ثوانٍ متاحة
  const click = ev("click")[0], enter = ev("enter")[0];
  const scrolls = ev("scroll_start");
  const scrollEnd = ev("scroll_end").slice(-1)[0]?.t ?? rec.duration - 0.3;
  const segs: Segment[] = [];
  let left = avail;
  if (click && enter) {
    const s = { from: click.t - 0.4, to: enter.t + 0.5, rate: 1.5 };
    segs.push(s);
    left -= (s.to - s.from) / s.rate;
  }
  const s0 = from ?? (scrolls[0]?.t ?? 1.5) - 0.3;
  const span = scrollEnd - s0;
  if (left > 0.5) {
    const rate = Math.min(2, Math.max(0.6, span / left)); // لا نسرّع أكثر من ×2: المشاهد يلحق يقرأ
    segs.push({ from: s0, to: Math.min(scrollEnd, s0 + left * rate), rate });
  }
  return segs;
};

export const RecBeat: React.FC<{ rec: RecData; frames: number; url: string; from?: number; zoomTyping?: boolean }> = ({ rec, frames, url, from, zoomTyping = true }) => {
  const { fps } = useVideoConfig();
  const segs = autoSegments(rec, frames, fps, from);
  const click = rec.events.find((e) => e.type === "click");
  const enter = rec.events.find((e) => e.type === "enter");
  const zoom: ZoomKey[] = [{ at: 0, scale: 1, x: 0.5, y: 0.5 }];
  if (zoomTyping && click && enter) {
    const c = recTimeToFrame(click.t, segs, fps)!, e = recTimeToFrame(enter.t, segs, fps)!;
    zoom.push({ at: ENTER + c, scale: 2.1, x: 0.42, y: 0.02 }, { at: ENTER + e + 14, scale: 1, x: 0.5, y: 0.5 });
  }
  const total = segmentsFrames(segs, fps);
  // تقريب بطيء أثناء التمرير — يُبقي العين مشدودة
  zoom.push({ at: Math.min(frames - 20, ENTER + total - 10), scale: 1.12, x: 0.5, y: 0.4 });
  return (
    <MacWindow url={url} width={1600} zoom={zoom} exitAt={frames - 14}>
      <Sequence from={ENTER}>
        <ScreenRec rec={rec} segments={segs} />
      </Sequence>
    </MacWindow>
  );
};
