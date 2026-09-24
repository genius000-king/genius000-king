export declare const WPS: number;
export declare const PAD: number;
export declare const MIN: number;
export declare const CHAPTER: number;
export declare const words: (s: string) => number;
export interface TimedBeat { id: string; say: string; title?: string; sub?: string; from: number; frames: number }
export declare const timeline: (script: (string | undefined)[][], fps?: number) => TimedBeat[];
