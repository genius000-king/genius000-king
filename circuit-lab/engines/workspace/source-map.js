// A board's firmware is compiled as one text: main.ino first, then the other files alphabetically,
// joined by newlines (sourceForBoard). These map between lines of that text and file:line.

export const fileOrder = files =>
  Object.keys(files).sort((a, b) => (a === 'main.ino' ? -1 : b === 'main.ino' ? 1 : a.localeCompare(b)));

/** Line of the compiled text → {file, line}. */
export function fileLine(files, globalLine) {
  let line = globalLine;
  const order = fileOrder(files);
  for (const file of order) {
    const count = files[file].split('\n').length;
    if (line <= count) return {file, line};
    line -= count;
  }
  return {file: order.at(-1) ?? 'main.ino', line};
}

/** file:line → line of the compiled text. */
export function globalLine(files, file, line) {
  let offset = 0;
  for (const name of fileOrder(files)) {
    if (name === file) return offset + line;
    offset += files[name].split('\n').length;
  }
  return null;
}
