import React, {useId} from 'react';

/** Full-bleed SVG canvas in 1920×1080 design units, cropped to fill like object-fit: cover. */
export const Canvas: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{display: 'block', ...style}}>
    {children}
  </svg>
);

/** Gaussian blur filter with a unique id; returns [defs, url]. */
export const useBlur = (amount: number): [React.ReactNode, string | undefined] => {
  const id = useId().replace(/:/g, '');
  if (amount <= 0.05) return [null, undefined];
  return [
    <filter key={id} id={`b${id}`} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation={amount} />
    </filter>,
    `url(#b${id})`,
  ];
};

export const useIds = (...names: string[]) => {
  const base = useId().replace(/:/g, '');
  return Object.fromEntries(names.map((n) => [n, `${n}${base}`])) as Record<string, string>;
};

/** Deterministic pseudo-random in [0,1). */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
