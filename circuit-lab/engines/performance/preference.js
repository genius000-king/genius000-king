// The user's choice is per device, not per project, so it lives outside the saved project.
const KEY = 'circuit-lab-performance';

export function readMode() {
  try {
    const mode = localStorage.getItem(KEY);
    return mode === 'saver' || mode === 'quality' ? mode : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeMode(mode) {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {}
}
