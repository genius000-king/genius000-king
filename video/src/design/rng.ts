/**
 * Deterministic PRNG. Every scattered dot, neuron and magnetic domain in this
 * film is placed by seed — so frame 12,000 looks identical on every render,
 * and a re-render of one chapter still matches the rest.
 */
export const makeRng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
};

export const range = (n: number) => Array.from({length: n}, (_, i) => i);
