# من نقطة إلى عالم — a 30-second motion-design showreel, written as code

Every pixel and every sample of `out/showreel.mp4` (1920×1080, 60 fps, stereo) is computed from equations.
No camera, no video editor, no audio samples.

| | |
|---|---|
| Picture | WebGL2 (raymarched GLSL, instanced geometry, HDR bloom / chromatic aberration / FXAA) + Canvas2D for type and line-work, rendered headless in Chromium |
| Sound | numpy/scipy synthesis — D Hijaz, 128 BPM, 16 bars = exactly 30 s |
| Time | one shared timeline (`js/timeline.js` → `timeline.json`): the slow-motion / freeze / rewind of chapter 6 uses the *same* τ(t) curve for picture and sound |

## Rebuild
```bash
node export_timeline.js                       # timeline.json for the score
python3 music.py                              # → audio.wav          (needs numpy, scipy)
node render.js frames 0 2 1 60 &              # worker 0 of 2       (playwright + chromium)
node render.js frames 1 2 1 60 & wait         # worker 1 of 2 → frames/frame_00000.jpg …
./build.sh frames out/showreel.mp4            # mux with ffmpeg
node preview.js stills 0.5 1.5,9,20           # quick stills at given times (scale 0.5)
```

## Chapters (each one is a transformation of the previous)
٠١ نقطة → ٠٢ هندسة → ٠٣ عمق → ٠٤ حرف → ٠٥ تحوّل → ٠٦ زمن → ٠٧ سرعة → ٠٨ عالم
