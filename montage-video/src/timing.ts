// All times are absolute seconds in the voiceover (from scripts/words.json).
export const FPS = 30;
export const DURATION = 232;

export const SECTIONS = {
  intro: [0, 26.8],
  collage: [26.8, 49.3],
  doc: [49.3, 72.25],
  motion: [72.25, 96.05],
  cine: [96.05, 118.95],
  fast: [118.95, 146.3],
  minimal: [146.3, 165.4],
  ad: [165.4, 188.05],
  story: [188.05, 207.5],
  outro: [207.5, DURATION],
} as const;

export type SectionName = keyof typeof SECTIONS;
