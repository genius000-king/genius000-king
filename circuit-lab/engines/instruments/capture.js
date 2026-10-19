// Files for desktop analysis tools: logic captures as VCD (PulseView, GTKWave, sigrok) and oscilloscope
// captures as CSV (spreadsheets, Python, MATLAB).

const ids = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Logic analyzer capture {t: [ms], v: [[byte]]} → Value Change Dump text, 1 µs resolution. */
export function toVcd(capture, {channels = 8, names = [], date = new Date().toISOString()} = {}) {
  const lines = [
    `$date ${date} $end`,
    '$version Circuit Lab logic analyzer $end',
    '$timescale 1 us $end',
    '$scope module logic $end',
  ];
  for (let ch = 0; ch < channels; ch++) lines.push(`$var wire 1 ${ids[ch]} ${names[ch] ?? `D${ch}`} $end`);
  lines.push('$upscope $end', '$enddefinitions $end');
  const t = Array.from(capture.t),
    t0 = t[0] ?? 0;
  let last = null;
  t.forEach((ms, i) => {
    const byte = capture.v[i][0] & 0xff;
    if (byte === last) return;
    const changed = [];
    for (let ch = 0; ch < channels; ch++)
      if (last === null || ((byte ^ last) >> ch) & 1) changed.push(`${(byte >> ch) & 1}${ids[ch]}`);
    lines.push(
      `#${Math.round((ms - t0) * 1000)}`,
      ...(last === null ? ['$dumpvars', ...changed, '$end'] : changed)
    );
    last = byte;
  });
  if (t.length) lines.push(`#${Math.round((t.at(-1) - t0) * 1000)}`);
  return lines.join('\n') + '\n';
}

/** Oscilloscope capture {t: [ms], v: [[ch1, ch2, …]]} → CSV with a header row. */
export function toCsv(capture, labels = ['CH1 (V)', 'CH2 (V)']) {
  const rows = ['time (ms),' + labels.join(',')],
    t = Array.from(capture.t);
  t.forEach((ms, i) => rows.push([ms, ...labels.map((_, ch) => capture.v[i][ch] ?? '')].join(',')));
  return rows.join('\n') + '\n';
}
