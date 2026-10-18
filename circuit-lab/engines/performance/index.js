// Performance engine: how much the device can render, what the user chose, and live resolution scaling.
export {detectDevice, classify, gpuName} from './device.js';
export {PROFILES, MODES, profileFor} from './profiles.js';
export {readMode, writeMode} from './preference.js';
export {AdaptiveResolution} from './adaptive.js';
