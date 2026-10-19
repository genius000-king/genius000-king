// Serial Plotter: the Arduino IDE convention. Every complete serial line with numbers becomes one sample;
// values are separated by spaces, tabs or commas and may be labelled `name:value`. Unlabelled values are
// called value 1, value 2, … by position. Lines with no number are skipped (they are just text).

const TOKEN = /[\s,]+/;

/** One line → {label: number} or null. */
export function parsePlotLine(text) {
  const out = {};
  let index = 0,
    any = false;
  for (const token of text.trim().split(TOKEN)) {
    if (!token) continue;
    const colon = token.lastIndexOf(':');
    const label = colon > 0 ? token.slice(0, colon) : null,
      raw = colon > 0 ? token.slice(colon + 1) : token;
    if (raw === '' && label) continue; // "label:" followed by a space-separated value is not supported by the IDE either
    const value = Number(raw);
    index++;
    if (!Number.isFinite(value)) {
      if (!label) return null; // free text: not a data line
      continue;
    }
    out[label ?? `value ${index}`] = value;
    any = true;
  }
  return any ? out : null;
}

/** Serial log entries (from the simulator) → series for plotting: {times, series: {label: [values]}}. */
export function plotSeries(logs, limit = 500) {
  const lines = logs.filter(l => l.kind === 'serial');
  // the last line may still be receiving characters
  if (lines.at(-1)?.open) lines.pop();
  const samples = [];
  for (const l of lines) {
    const values = parsePlotLine(l.prefix ? l.text.slice(l.prefix.length) : l.text);
    if (values) samples.push({time: l.time, values});
  }
  const recent = samples.slice(-limit),
    labels = [...new Set(recent.flatMap(s => Object.keys(s.values)))];
  const series = Object.fromEntries(labels.map(k => [k, recent.map(s => s.values[k] ?? null)]));
  return {times: recent.map(s => s.time), series};
}
