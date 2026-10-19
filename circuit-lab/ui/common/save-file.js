// Saves text as a file; the exporter module (and its circuit code) loads only when something is saved.
export const saveFile = (name, text, type) =>
  import('../../engines/workspace/exporters.js').then(m => m.download(name, text, type));

export const slugOf = name =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'capture';
