// _canvas.js — مساعد مشترك لمؤثرات لوحة الرسم: قياس DPR، إعادة الضبط عند
// تغيّر الحجم، وتعليق الرسم تلقائياً حين يخرج العنصر من الشاشة.
// ⚠️ هذا القيد هو ما يبقي لوحتَي رسم نشطتين على الأكثر في أي لحظة.
import loop from './loop.js';
import { on } from '../core/dom.js';

export function makeCanvas(host, { onResize, onFrame, always = false }) {
  const canvas = host.tagName === 'CANVAS' ? host : Object.assign(document.createElement('canvas'), {});
  if (canvas !== host) { canvas.setAttribute('aria-hidden', 'true'); host.append(canvas); }
  const ctx = canvas.getContext('2d');
  const box = canvas === host ? host.parentElement || host : host;

  let w = 0, h = 0, dpr = 1, running = false, unsub = null;

  function resize() {
    const r = (canvas === host ? host : box).getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.inlineSize = `${w}px`;
    canvas.style.blockSize = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize?.({ ctx, w, h });
  }

  function start() { if (!running) { running = true; unsub = loop.add((dt, now) => onFrame({ ctx, w, h, dt, now })); } }
  function stop() { if (running) { running = false; unsub?.(); unsub = null; } }

  const offResize = on(window, 'resize', resize, { passive: true });
  resize();

  let io = null;
  if (always) start();
  else {
    io = new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(canvas === host ? host : box);
  }

  return {
    canvas, get ctx() { return ctx; }, get w() { return w; }, get h() { return h; },
    destroy() { stop(); io?.disconnect(); offResize(); if (canvas !== host) canvas.remove(); },
  };
}
