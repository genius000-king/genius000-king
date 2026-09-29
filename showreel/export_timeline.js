// Dumps the shared timeline (scene boundaries, finale schedule, the time-warp curve τ(u)) for the music script.
const TL = require('./js/timeline.js');
const tau = []; for (let i = 0; i <= 3750; i++) tau.push(+TL.tau(i / 1000).toFixed(6));
require('fs').writeFileSync(__dirname + '/timeline.json', JSON.stringify({
  BPM: TL.BPM, BEAT: TL.BEAT, BAR: TL.BAR, DUR: TL.DUR, chapters: TL.chapters, impacts: TL.impacts, finale: TL.finale, tau_dt: 0.001, tau,
}));
console.log('timeline.json written, tau samples:', tau.length, 'max tau', Math.max(...tau));
