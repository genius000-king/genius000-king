'use strict';
// The score is written from THESE numbers — the same constants that drive the picture.
window.dumpCues = () => {
  Film.heroSet(); const ideas = Film.ideas();
  const w = Film.wire, TM = Film.T_M, TCR = Film.clash.TCR;
  const warp = []; for (let i = 0; i <= 60000; i++) warp.push(+Army.warp(i / 1000).toFixed(6));
  const crack = CrackGen.cues(Film.crack.segs);
  return {
    BPM: TL.BPM, BEAT: TL.BEAT, BAR: TL.BAR, DUR: TL.DUR,
    crack, T_POINT: 1.2, T_LINE0: 1.9, T_CRACK: Film.crack.T_CRACK, T_BURST: Film.crack.T_BURST, T_IRIS0: 5.85, T_END: Film.crack.T_END,
    wire: w.EDGES.map((e, k) => +(w.T_WIRE + k * w.EDGE_DT).toFixed(4)), wireDur: 0.24, T_SOLID: 11.25,
    splits: [15.0, 15.0 + 2 * TL.BEAT, 15.0 + 4 * TL.BEAT, 15.0 + 12 * TL.BEAT],
    ideas: ideas.ideas.map(i => ({ name: i.name, t: +(TM + i.T).toFixed(4), spread: i.spread, dur: i.dur })), T_M: TM,
    dragon: { T0: 22.5, flapOmega: 5.2, jawOmega: 2.7 },
    castle: { T0: 30.0, riseStart: 0.25, riseEnd: 2.65 },
    rival: { T0: 37.5, wipe0: 37.7, wipe1: 39.8, march: Army.T_SLOW, charge: Army.T_CHARGE },
    clash: { slow0: 46.85, slow1: 47.10, fast0: 49.0, fast1: 49.8, TC: Army.T_C, TCR, ranks: Array.from({ length: Army.RANKS }, (_, rk) => +Army.unwarp(Army.T_C + 0.05 * rk).toFixed(4)) },
    unity: Film.unityT,
    warp,
  };
};
