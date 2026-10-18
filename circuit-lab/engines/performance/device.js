// What the device can afford, estimated once per session from what the browser reports.
// Nothing here is exact (browsers round or hide memory and GPU names), so the result is a tier, not a score.

const WEAK_GPU =
  /SwiftShader|llvmpipe|Software|Mali-(4\d\d|T[6-8]\d\d|G(31|51|52))|Adreno \(TM\) [2-5]\d\d|PowerVR|Intel\(R\) HD Graphics( [2-5]\d{3})?$|GMA|Apple A(8|9|10)\b/i;
const SOFTWARE_GPU = /SwiftShader|llvmpipe|Software/i;
const CACHE = 'circuit-lab-gpu';

/** The GPU name, read from a throwaway WebGL context (cached for the session). */
export function gpuName() {
  try {
    const cached = sessionStorage.getItem(CACHE);
    if (cached !== null) return cached;
  } catch {}
  let name = '';
  try {
    const canvas = document.createElement('canvas'),
      gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {}
  try {
    sessionStorage.setItem(CACHE, name);
  } catch {}
  return name;
}

/** Classifies a device description; pure, so it can be tested without a browser. */
export function classify({cores = 4, memory, saveData = false, mobile = false, gpu = ''}) {
  const software = SOFTWARE_GPU.test(gpu);
  if (software || saveData || WEAK_GPU.test(gpu) || cores <= 2 || (memory !== undefined && memory <= 2))
    return {tier: 'low', software};
  if (mobile || cores <= 4 || (memory !== undefined && memory <= 4)) return {tier: 'medium', software};
  return {tier: 'high', software};
}

let detected;
/** The device of this session: cores, memory (GB, rounded by the browser), data saver, GPU and tier. */
export function detectDevice() {
  if (detected) return detected;
  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const facts = {
    cores: nav.hardwareConcurrency ?? 4,
    memory: nav.deviceMemory,
    saveData: !!nav.connection?.saveData,
    mobile: !!(nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(nav.userAgent ?? '')),
    gpu: typeof document === 'undefined' ? '' : gpuName(),
  };
  detected = {...facts, ...classify(facts)};
  return detected;
}
