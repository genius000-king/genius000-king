/** Buzzer and speaker audio (after a user gesture). */
export function useSound(wb) {
  const {audio, audioEnabled, setAudioEnabled} = wb;
  const enableAudio = () => {
    if (!audio.current) {
      const ctx = new AudioContext(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'square';
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audio.current = {ctx, osc, gain};
    }
    audio.current.ctx.resume();
    setAudioEnabled(!audioEnabled);
  };
  return {enableAudio};
}
