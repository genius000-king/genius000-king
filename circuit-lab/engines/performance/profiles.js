// Rendering and update budgets per tier. Every number here trades looks for speed in one place.

export const PROFILES = {
  low: {
    label: 'Battery saver',
    pixelRatio: 1, // upper bound; adaptive resolution may go lower
    minPixelRatio: 0.6,
    antialias: false,
    shadows: false,
    shadowSize: 0,
    softShadows: false,
    environmentSize: 256, // reflection map width
    frameMs: 33, // at most ~30 frames per second
    stateMs: 100, // simulation snapshots to the UI, 10 per second
    webgpu: false,
    glass: false, // backdrop blur is the most expensive thing the UI draws
  },
  medium: {
    label: 'Balanced',
    pixelRatio: 1.5,
    minPixelRatio: 0.75,
    antialias: true,
    shadows: true,
    shadowSize: 1024,
    softShadows: false,
    environmentSize: 512,
    frameMs: 0,
    stateMs: 50,
    webgpu: false,
    glass: true,
  },
  high: {
    label: 'Quality',
    pixelRatio: 2,
    minPixelRatio: 1,
    antialias: true,
    shadows: true,
    shadowSize: 2048,
    softShadows: true,
    environmentSize: 1024,
    frameMs: 0,
    stateMs: 50,
    webgpu: true, // three's WebGPU renderer is a separate ~585 KB download, so only when asked for
    glass: true,
  },
};

export const MODES = {
  auto: 'Automatic',
  saver: 'Battery saver',
  quality: 'Quality',
};

/** The profile for a user mode on a detected device. */
export function profileFor(mode, device) {
  const tier = mode === 'saver' ? 'low' : mode === 'quality' ? 'high' : device.tier;
  const profile = {...PROFILES[tier], tier, mode};
  if (mode === 'auto') profile.webgpu = false;
  // a CPU rasteriser cannot keep up with full quality whatever the user picks
  if (device.software) {
    profile.pixelRatio = 1;
    profile.shadowSize = Math.min(profile.shadowSize, 512);
    profile.softShadows = false;
    profile.frameMs = Math.max(profile.frameMs, 48);
  }
  return profile;
}
